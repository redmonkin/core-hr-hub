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

      // Fetch all leave types with their days_per_year
      const { data: leaveTypes, error: typesError } = await supabase
        .from("leave_types")
        .select("id, name, days_per_year, is_paid")
        .order("name");

      if (typesError) throw typesError;

      // Fetch approved leave requests for this employee for the current year
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const { data: approvedRequests, error: requestsError } = await supabase
        .from("leave_requests")
        .select("leave_type_id, days_count")
        .eq("employee_id", employeeId)
        .eq("status", "approved")
        .gte("start_date", yearStart)
        .lte("start_date", yearEnd);

      if (requestsError) throw requestsError;

      // Calculate used days per leave type
      const usedDaysMap = new Map<string, number>();
      (approvedRequests || []).forEach((req) => {
        const current = usedDaysMap.get(req.leave_type_id) || 0;
        usedDaysMap.set(req.leave_type_id, current + req.days_count);
      });

      // Build leave balances from leave types
      return (leaveTypes || []).map((lt): LeaveBalance => ({
        id: lt.id,
        leave_type: { name: lt.name, is_paid: lt.is_paid },
        total_days: lt.days_per_year,
        used_days: usedDaysMap.get(lt.id) || 0,
        year: currentYear,
      }));
    },
    enabled: !!employeeId,
  });
}
