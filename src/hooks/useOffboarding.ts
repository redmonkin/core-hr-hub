import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

export interface ExitTask {
  id: string;
  title: string;
  category: string;
  asset_assignment_id: string | null;
  position: number;
  done_at: string | null;
  created_at: string;
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
  created_at: string;
  completed_at: string | null;
  employee: {
    first_name: string;
    last_name: string;
    email: string;
    designation: string | null;
    department: { name: string } | null;
  } | null;
  tasks: ExitTask[];
}

const EXIT_SELECT = `
  id, employee_id, reason, status, notice_date, last_working_day, notes, decision_notes, created_at, completed_at,
  employee:employees!employee_exits_employee_id_fkey(
    first_name, last_name, email, designation,
    department:departments!employees_department_id_fkey(name)
  ),
  tasks:exit_tasks(id, title, category, asset_assignment_id, position, done_at, created_at)
`;

const sortTasks = (tasks: ExitTask[]) =>
  [...tasks].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

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
      return ((data ?? []) as unknown as EmployeeExit[]).map((x) => ({ ...x, tasks: sortTasks(x.tasks ?? []) }));
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
    }) => {
      const { error } = await supabase.from("employee_exits").insert({
        employee_id: input.employeeId,
        reason: input.reason,
        notice_date: input.noticeDate,
        last_working_day: input.lastWorkingDay,
        notes: input.notes?.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("This person already has an offboarding in progress.");
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

/** Employee's own resignation; HR approves it. */
export function useResign() {
  const invalidate = useInvalidateExits();
  return useMutation({
    mutationFn: async (input: { employeeId: string; lastWorkingDay: string; notes?: string }) => {
      const { error } = await supabase.from("employee_exits").insert({
        employee_id: input.employeeId,
        reason: "resignation",
        last_working_day: input.lastWorkingDay,
        notes: input.notes?.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You already have a resignation in progress.");
        throw error;
      }
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
    }) => {
      const update: Database["public"]["Tables"]["employee_exits"]["Update"] = {};
      if (input.status) update.status = input.status;
      if (input.lastWorkingDay) update.last_working_day = input.lastWorkingDay;
      if (input.decisionNotes !== undefined) update.decision_notes = input.decisionNotes?.trim() || null;
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

export function useToggleExitTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("exit_tasks")
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-exits"] }),
  });
}

export function useAddExitTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ exitId, title }: { exitId: string; title: string }) => {
      const { error } = await supabase
        .from("exit_tasks")
        .insert({ exit_id: exitId, title: title.trim(), category: "custom", position: 1000 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-exits"] }),
  });
}
