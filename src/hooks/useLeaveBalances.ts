import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaveBalance {
  id: string;
  leave_type: { name: string; is_paid: boolean | null };
  total_days: number;
  used_days: number;
  year: number;
}

export function useLeaveBalances(employeeId: string | undefined) {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["leave-balances", employeeId, currentYear],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("leave_balances")
        .select(`
          id,
          total_days,
          used_days,
          year,
          leave_types (name, is_paid)
        `)
        .eq("employee_id", employeeId)
        .eq("year", currentYear);

      if (error) throw error;

      return data.map((item) => ({
        id: item.id,
        leave_type: item.leave_types,
        total_days: item.total_days,
        used_days: item.used_days,
        year: item.year,
      })) as LeaveBalance[];
    },
    enabled: !!employeeId,
  });
}
