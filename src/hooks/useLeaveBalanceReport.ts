import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaveBalanceRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  balances: {
    leaveType: string;
    total: number;
    used: number;
    remaining: number;
  }[];
}

export interface LeaveBalanceReport {
  year: number;
  leaveTypes: string[];
  records: LeaveBalanceRecord[];
}

export function useLeaveBalanceReport(year: number) {
  return useQuery({
    queryKey: ["leave-balance-report", year],
    queryFn: async (): Promise<LeaveBalanceReport> => {
      // Get all leave types
      const { data: leaveTypes, error: typesError } = await supabase
        .from("leave_types")
        .select("id, name")
        .order("name");

      if (typesError) throw typesError;

      // Get all employees with their leave balances
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          employee_code,
          first_name,
          last_name,
          department:departments(name)
        `)
        .in("status", ["active", "onboarding"])
        .order("first_name");

      if (empError) throw empError;

      // Get leave balances for the year
      const { data: balances, error: balError } = await supabase
        .from("leave_balances")
        .select("employee_id, leave_type_id, total_days, used_days")
        .eq("year", year);

      if (balError) throw balError;

      // Build records
      const records: LeaveBalanceRecord[] = (employees || []).map((emp) => {
        const employeeBalances = (leaveTypes || []).map((lt) => {
          const balance = balances?.find(
            (b) => b.employee_id === emp.id && b.leave_type_id === lt.id
          );
          return {
            leaveType: lt.name,
            total: balance?.total_days || 0,
            used: balance?.used_days || 0,
            remaining: (balance?.total_days || 0) - (balance?.used_days || 0),
          };
        });

        return {
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          department: emp.department?.name || "Unassigned",
          balances: employeeBalances,
        };
      });

      return {
        year,
        leaveTypes: (leaveTypes || []).map((lt) => lt.name),
        records,
      };
    },
  });
}
