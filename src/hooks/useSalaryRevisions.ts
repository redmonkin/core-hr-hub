import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import { fetchImageAsDataUrl } from "@/lib/pdfTheme";
import {
  toComponents,
  type SalaryComponents,
  type SalaryRevisionStatus,
  type SalaryRevisionType,
} from "@/lib/salaryRevision";
import { downloadSalaryRevisionLetter } from "@/lib/salaryRevisionLetter";

export interface SalaryRevision {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeUserId: string | null;
  revisionType: SalaryRevisionType;
  status: SalaryRevisionStatus;
  effectiveFrom: string;
  reason: string | null;
  performanceReviewId: string | null;
  reviewPeriod: string | null;
  components: SalaryComponents;
  previous: SalaryComponents | null;
  notifyEmployee: boolean;
  adjustmentAmount: number;
  adjustmentNote: string | null;
  createdBy: string | null;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  appliedAt: string | null;
  emailedAt: string | null;
}

const REVISION_SELECT = `
  id, employee_id, revision_type, status, effective_from, reason, performance_review_id,
  basic_salary, hra, transport_allowance, medical_allowance, other_allowances, tax_deduction, pf_deduction,
  previous, notify_employee, adjustment_amount, adjustment_note, created_by, created_at,
  decided_by, decided_at, decision_notes, applied_at, emailed_at,
  employee:employees(first_name, last_name, user_id),
  review:performance_reviews(review_period)
`;

type RevisionRow = Record<string, unknown> & {
  employee?: { first_name: string; last_name: string; user_id: string | null } | null;
  review?: { review_period: string } | null;
};

function mapRevision(row: RevisionRow): SalaryRevision {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : "",
    employeeUserId: row.employee?.user_id ?? null,
    revisionType: row.revision_type as SalaryRevisionType,
    status: row.status as SalaryRevisionStatus,
    effectiveFrom: row.effective_from as string,
    reason: (row.reason as string | null) ?? null,
    performanceReviewId: (row.performance_review_id as string | null) ?? null,
    reviewPeriod: row.review?.review_period ?? null,
    components: toComponents(row as Partial<Record<keyof SalaryComponents, unknown>>),
    previous: row.previous ? toComponents(row.previous as Partial<Record<keyof SalaryComponents, unknown>>) : null,
    notifyEmployee: !!row.notify_employee,
    adjustmentAmount: Number(row.adjustment_amount ?? 0),
    adjustmentNote: (row.adjustment_note as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    decisionNotes: (row.decision_notes as string | null) ?? null,
    appliedAt: (row.applied_at as string | null) ?? null,
    emailedAt: (row.emailed_at as string | null) ?? null,
  };
}

async function fetchRevision(id: string): Promise<SalaryRevision | null> {
  const { data, error } = await supabase.from("salary_revisions").select(REVISION_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRevision(data as unknown as RevisionRow) : null;
}

/** Every revision for one person, newest first (RLS: payroll view, or the person's own agreed ones). */
export function useEmployeeSalaryRevisions(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["salary-revisions", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_revisions")
        .select(REVISION_SELECT)
        .eq("employee_id", employeeId!)
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapRevision(row as unknown as RevisionRow));
    },
  });
}

/** Revisions waiting for someone to approve them. */
export function usePendingSalaryRevisions(enabled = true) {
  return useQuery({
    queryKey: ["salary-revisions", "pending"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_revisions")
        .select(REVISION_SELECT)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapRevision(row as unknown as RevisionRow));
    },
  });
}

/** Pay changes made before revisions existed (salary_history), newest first. */
export function useLegacySalaryHistory(employeeId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["salary-history", employeeId],
    enabled: !!employeeId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_history")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Performance reviews of one person, to link a revision to. */
export function useReviewsForRevision(employeeId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["salary-revision-reviews", employeeId],
    enabled: !!employeeId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("id, review_period, review_date, overall_rating")
        .eq("employee_id", employeeId!)
        .order("review_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Is this employee record the signed-in user's own? (Only admins may revise their own pay.) */
export function useIsOwnEmployee(employeeId: string | null | undefined) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["employee-user-id", employeeId],
    enabled: !!employeeId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("user_id").eq("id", employeeId!).maybeSingle();
      if (error) throw error;
      return data?.user_id ?? null;
    },
  });
  return !!user?.id && data === user.id;
}

// ---------------------------------------------------------------------------
// Approval switch (organization_settings 'salary_revision_approval')
// ---------------------------------------------------------------------------

export function useSalaryRevisionApproval() {
  return useQuery({
    queryKey: ["salary-revision-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("setting_value")
        .eq("setting_key", "salary_revision_approval")
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value as { enabled?: boolean } | null)?.enabled === true;
    },
  });
}

export function useSetSalaryRevisionApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("organization_settings")
        .upsert(
          { setting_key: "salary_revision_approval", setting_value: { enabled } as unknown as Json },
          { onConflict: "setting_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salary-revision-approval"] }),
  });
}

// ---------------------------------------------------------------------------
// Create, decide, cancel
// ---------------------------------------------------------------------------

export interface SalaryRevisionInput {
  employeeId: string;
  revisionType: SalaryRevisionType;
  effectiveFrom: string;
  reason: string;
  performanceReviewId: string | null;
  components: SalaryComponents;
  notifyEmployee: boolean;
}

export interface SalaryRevisionResult {
  revision: SalaryRevision | null;
  /** Set when the revision applied and the employee should have been emailed but wasn't. */
  emailError?: string;
}

/** Emails the employee once a revision has been applied (if they're to be told). */
async function emailIfApplied(revision: SalaryRevision | null): Promise<string | undefined> {
  if (!revision || revision.status !== "applied" || !revision.notifyEmployee || revision.emailedAt) return undefined;
  const { error } = await supabase.functions.invoke("salary-revisions", {
    body: { action: "email", revision_id: revision.id },
  });
  return error ? "The revision is saved, but the email to the employee couldn't be sent." : undefined;
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["salary-revisions"] });
  queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
  queryClient.invalidateQueries({ queryKey: ["employee-salary-structure"] });
  queryClient.invalidateQueries({ queryKey: ["my-salary-structure"] });
  queryClient.invalidateQueries({ queryKey: ["salary-history"] });
}

export function useCreateSalaryRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryRevisionInput): Promise<SalaryRevisionResult> => {
      const { data, error } = await supabase
        .from("salary_revisions")
        .insert({
          employee_id: input.employeeId,
          revision_type: input.revisionType,
          effective_from: input.effectiveFrom,
          reason: input.reason.trim() || null,
          performance_review_id: input.performanceReviewId,
          notify_employee: input.notifyEmployee,
          ...input.components,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Read it back: it may already have been applied by the database.
      const revision = await fetchRevision(data.id);
      return { revision, emailError: await emailIfApplied(revision) };
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDecideSalaryRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "scheduled" | "rejected" | "cancelled";
      notes?: string;
    }): Promise<SalaryRevisionResult> => {
      const { data, error } = await supabase
        .from("salary_revisions")
        .update({ status, decision_notes: notes?.trim() || null })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to change this revision.");
      const revision = await fetchRevision(id);
      return { revision, emailError: status === "scheduled" ? await emailIfApplied(revision) : undefined };
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Revision letter
// ---------------------------------------------------------------------------

export async function downloadRevisionLetter(revision: SalaryRevision) {
  const [{ data: employee }, { data: brandingRow }] = await Promise.all([
    supabase
      .from("employees")
      .select("first_name, last_name, employee_code, designation, department:departments!employees_department_id_fkey(name)")
      .eq("id", revision.employeeId)
      .maybeSingle(),
    supabase.from("organization_settings").select("setting_value").eq("setting_key", "company_branding").maybeSingle(),
  ]);
  const branding = (brandingRow?.setting_value ?? {}) as { company_name?: string; company_address?: string; icon_url?: string | null };
  const logoDataUrl = await fetchImageAsDataUrl(branding.icon_url);
  const letterDate = (revision.appliedAt ?? revision.decidedAt ?? revision.createdAt).slice(0, 10);

  downloadSalaryRevisionLetter({
    employeeName: employee ? `${employee.first_name} ${employee.last_name}` : revision.employeeName,
    employeeFirstName: employee?.first_name ?? revision.employeeName.split(" ")[0] ?? "",
    employeeCode: employee?.employee_code,
    designation: employee?.designation,
    department: (employee?.department as { name?: string } | null)?.name,
    revisionType: revision.revisionType,
    effectiveFrom: revision.effectiveFrom,
    letterDate,
    previous: revision.previous ?? revision.components,
    revised: revision.components,
    companyName: branding.company_name || undefined,
    companyAddress: branding.company_address || undefined,
    logoDataUrl,
  });
}
