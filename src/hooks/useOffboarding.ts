import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type ExitReason = Database["public"]["Enums"]["exit_reason"];
export type ExitStatus = Database["public"]["Enums"]["exit_status"];

export const EXIT_REASONS: { value: ExitReason; label: string }[] = [
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "end_of_contract", label: "End of contract" },
  { value: "retirement", label: "Retirement" },
  { value: "other", label: "Other" },
];

export const exitReasonLabel = (reason: ExitReason) =>
  EXIT_REASONS.find((r) => r.value === reason)?.label ?? reason;

export interface ChecklistSection {
  name: string;
  items: string[];
}

/** Who an offboarding's checklist is emailed to: employees and/or outside addresses. */
export interface ExitRecipients {
  employeeIds: string[];
  emails: string[];
}

export interface EmployeeExit {
  id: string;
  employee_id: string;
  reason: ExitReason;
  status: ExitStatus;
  notice_date: string;
  last_working_day: string;
  notes: string | null;
  decision_notes: string | null;
  email_note: string | null;
  notify_employee_ids: string[];
  notify_emails: string[];
  notified_at: string | null;
  reminder_sent_at: string | null;
  checklist: { sections: ChecklistSection[] } | null;
  created_at: string;
  completed_at: string | null;
  employee: {
    first_name: string;
    last_name: string;
    email: string;
    designation: string | null;
    manager_id: string | null;
    department_id: string | null;
    department: { name: string } | null;
  } | null;
}

const EXIT_SELECT = `
  id, employee_id, reason, status, notice_date, last_working_day, notes, decision_notes,
  email_note, notify_employee_ids, notify_emails, notified_at, reminder_sent_at, checklist,
  created_at, completed_at,
  employee:employees!employee_exits_employee_id_fkey(
    first_name, last_name, email, designation, manager_id, department_id,
    department:departments!employees_department_id_fkey(name)
  )
`;

/** Open exits (requested / in progress) and those completed in the last 90 days. */
export function useEmployeeExits(enabled = true) {
  return useQuery({
    queryKey: ["employee-exits"],
    enabled,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("employee_exits")
        .select(EXIT_SELECT)
        .or(`status.in.(requested,in_progress),and(status.eq.completed,completed_at.gte."${since}")`)
        .order("last_working_day", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeExit[];
    },
  });
}

/** The signed-in employee's most recent exit, if any (for the resignation card). */
export function useMyExit(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-exit", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exits")
        .select("id, reason, status, notice_date, last_working_day, notes, decision_notes, created_at")
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Checklist template (organization_settings 'offboarding_checklist')
// ---------------------------------------------------------------------------

export function useOffboardingChecklist() {
  return useQuery({
    queryKey: ["offboarding-checklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("setting_value")
        .eq("setting_key", "offboarding_checklist")
        .maybeSingle();
      if (error) throw error;
      const sections = (data?.setting_value as { sections?: ChecklistSection[] } | null)?.sections;
      return Array.isArray(sections) ? sections : [];
    },
  });
}

export function useSaveOffboardingChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sections: ChecklistSection[]) => {
      const cleaned = sections
        .map((s) => ({ name: s.name.trim(), items: s.items.map((i) => i.trim()).filter(Boolean) }))
        .filter((s) => s.name && s.items.length > 0);
      const { error } = await supabase
        .from("organization_settings")
        .upsert(
          { setting_key: "offboarding_checklist", setting_value: { sections: cleaned } as unknown as Json },
          { onConflict: "setting_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offboarding-checklist"] }),
  });
}

/**
 * Default recipients for an offboarding email: the person's reporting manager
 * and every department manager (never the person leaving).
 */
export async function defaultRecipientIds(employeeId: string): Promise<string[]> {
  const [{ data: employee }, { data: departments }] = await Promise.all([
    supabase.from("employees").select("manager_id").eq("id", employeeId).maybeSingle(),
    supabase.from("departments").select("manager_id").not("manager_id", "is", null),
  ]);
  const ids = new Set<string>();
  if (employee?.manager_id) ids.add(employee.manager_id);
  for (const d of departments ?? []) if (d.manager_id) ids.add(d.manager_id);
  ids.delete(employeeId);
  return [...ids];
}

// ---------------------------------------------------------------------------
// Emails (offboarding-email function)
// ---------------------------------------------------------------------------

export interface EmailPreview {
  subject: string;
  html: string;
  to: string[];
  reply_to: string | null;
}

async function callOffboardingEmail<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("offboarding-email", { body });
  if (error) {
    let message = error.message || "The email couldn't be sent";
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await (error.context as Response).json()) as { error?: string };
        if (payload?.error) message = payload.error;
      } catch {
        // body wasn't JSON; keep the generic message
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export const sendChecklistEmail = (exitId: string) =>
  callOffboardingEmail<{ sent: number }>({ action: "checklist", exit_id: exitId });

export const sendResignationEmail = (exitId: string) =>
  callOffboardingEmail<{ sent: number }>({ action: "resignation", exit_id: exitId });

export const sendDecisionEmail = (exitId: string) =>
  callOffboardingEmail<{ sent: number }>({ action: "decision", exit_id: exitId });

export const previewChecklistEmail = (draft: {
  employeeId: string;
  reason: ExitReason;
  lastWorkingDay: string;
  emailNote: string;
  recipients: ExitRecipients;
}) =>
  callOffboardingEmail<EmailPreview>({
    action: "preview",
    draft: {
      employee_id: draft.employeeId,
      reason: draft.reason,
      last_working_day: draft.lastWorkingDay,
      email_note: draft.emailNote.trim() || null,
      notify_employee_ids: draft.recipients.employeeIds,
      notify_emails: draft.recipients.emails,
    },
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function useInvalidateExits() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["employee-exits"] });
    queryClient.invalidateQueries({ queryKey: ["my-exit"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["employee-stats"] });
  };
}

export function useStartOffboarding() {
  const invalidate = useInvalidateExits();
  return useMutation({
    mutationFn: async (input: {
      employeeId: string;
      reason: ExitReason;
      noticeDate: string;
      lastWorkingDay: string;
      notes?: string;
      emailNote?: string;
      recipients: ExitRecipients;
    }) => {
      const { data, error } = await supabase
        .from("employee_exits")
        .insert({
          employee_id: input.employeeId,
          reason: input.reason,
          notice_date: input.noticeDate,
          last_working_day: input.lastWorkingDay,
          notes: input.notes?.trim() || null,
          email_note: input.emailNote?.trim() || null,
          notify_employee_ids: input.recipients.employeeIds,
          notify_emails: input.recipients.emails,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("This person already has an offboarding in progress.");
        throw error;
      }
      // The record is saved either way; report the email separately.
      let emailed: number | null = null;
      let emailError: string | null = null;
      if (input.recipients.employeeIds.length + input.recipients.emails.length > 0) {
        try {
          emailed = (await sendChecklistEmail(data.id)).sent;
        } catch (e) {
          emailError = e instanceof Error ? e.message : String(e);
        }
      }
      return { id: data.id, emailed, emailError };
    },
    onSuccess: invalidate,
  });
}

/** Employee's own resignation; HR approves it. HR and the reporting manager are emailed. */
export function useResign() {
  const invalidate = useInvalidateExits();
  return useMutation({
    mutationFn: async (input: { employeeId: string; lastWorkingDay: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("employee_exits")
        .insert({
          employee_id: input.employeeId,
          reason: "resignation",
          last_working_day: input.lastWorkingDay,
          notes: input.notes?.trim() || null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("You already have a resignation in progress.");
        throw error;
      }
      // Fire and forget: the in-app notice already reached HR
      sendResignationEmail(data.id).catch((e) => console.error("Resignation email failed:", e));
    },
    onSuccess: invalidate,
  });
}

export function useUpdateExit() {
  const invalidate = useInvalidateExits();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status?: ExitStatus;
      lastWorkingDay?: string;
      decisionNotes?: string | null;
      emailNote?: string | null;
      recipients?: ExitRecipients;
    }) => {
      const update: Database["public"]["Tables"]["employee_exits"]["Update"] = {};
      if (input.status) update.status = input.status;
      if (input.lastWorkingDay) update.last_working_day = input.lastWorkingDay;
      if (input.decisionNotes !== undefined) update.decision_notes = input.decisionNotes?.trim() || null;
      if (input.emailNote !== undefined) update.email_note = input.emailNote?.trim() || null;
      if (input.recipients) {
        update.notify_employee_ids = input.recipients.employeeIds;
        update.notify_emails = input.recipients.emails;
      }
      const { error } = await supabase.from("employee_exits").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteExit() {
  const invalidate = useInvalidateExits();
  return useMutation({
    mutationFn: async (exitId: string) => {
      const { error } = await supabase.rpc("complete_employee_exit", { _exit_id: exitId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
