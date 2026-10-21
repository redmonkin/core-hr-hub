import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildLeaveBalanceRecords, type LeaveBalanceRecord, type LeaveBalanceType } from "@/lib/leaveBalances";

export type { LeaveBalanceCell, LeaveBalanceRecord, LeaveBalanceType } from "@/lib/leaveBalances";
export { formatBalanceCell, usedShare } from "@/lib/leaveBalances";

export interface LeaveBalanceReport {
  year: number;
  leaveTypes: LeaveBalanceType[];
  records: LeaveBalanceRecord[];
}

export function useLeaveBalanceReport(year: number) {
  return useQuery({
    queryKey: ["leave-balance-report", year],
    queryFn: async (): Promise<LeaveBalanceReport> => {
      const [typesRes, employeesRes, requestsRes, eligibilityRes] = await Promise.all([
        supabase.from("leave_types").select("id, name, days_per_year").order("name"),
        supabase
          .from("employees")
          .select("id, employee_code, first_name, last_name, department:departments!employees_department_id_fkey(name)")
          .in("status", ["active", "onboarding"])
          .order("first_name"),
        supabase
          .from("leave_requests")
          .select("employee_id, leave_type_id, days_count, status")
          .in("status", ["approved", "pending"])
          .gte("start_date", `${year}-01-01`)
          .lte("start_date", `${year}-12-31`),
        supabase.from("employee_leave_eligibility").select("employee_id, leave_type_id"),
      ]);
      if (typesRes.error) throw typesRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (eligibilityRes.error) throw eligibilityRes.error;

      const leaveTypes = typesRes.data ?? [];
      return {
        year,
        leaveTypes: leaveTypes.map((lt) => ({ id: lt.id, name: lt.name, daysPerYear: lt.days_per_year })),
        records: buildLeaveBalanceRecords({
          leaveTypes,
          employees: (employeesRes.data ?? []).map((e) => ({
            id: e.id,
            employee_code: e.employee_code,
            first_name: e.first_name,
            last_name: e.last_name,
            department: e.department?.name || "Unassigned",
          })),
          requests: requestsRes.data ?? [],
          eligibility: eligibilityRes.data ?? [],
        }),
      };
    },
  });
}
