import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamLeave {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_avatar: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
}

export function useTeamLeaves(month: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-leaves", user?.id, month.getMonth(), month.getFullYear()],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get current user's employee record
      const { data: myEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myEmployee) return [];

      // Get direct reports
      const { data: directReports } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_id", myEmployee.id);

      if (!directReports || directReports.length === 0) return [];

      const reportIds = directReports.map((r) => r.id);

      // Calculate month boundaries
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      // Get approved leave requests for direct reports in this month
      const { data: leaves, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          employee_id,
          start_date,
          end_date,
          days_count,
          employees!leave_requests_employee_id_fkey (
            first_name,
            last_name,
            avatar_url
          ),
          leave_types!leave_requests_leave_type_id_fkey (
            name
          )
        `)
        .eq("status", "approved")
        .in("employee_id", reportIds)
        .lte("start_date", format(endOfMonth, "yyyy-MM-dd"))
        .gte("end_date", format(startOfMonth, "yyyy-MM-dd"))
        .order("start_date", { ascending: true });

      if (error) throw error;

      return (leaves || []).map((leave): TeamLeave => ({
        id: leave.id,
        employee_id: leave.employee_id,
        employee_name: `${leave.employees?.first_name || ""} ${leave.employees?.last_name || ""}`.trim(),
        employee_avatar: leave.employees?.avatar_url || null,
        leave_type: leave.leave_types?.name || "Leave",
        start_date: leave.start_date,
        end_date: leave.end_date,
        days_count: leave.days_count,
      }));
    },
    enabled: !!user?.id,
  });
}

export function useIsManager() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-manager", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data: myEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myEmployee) return false;

      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", myEmployee.id);

      return (count || 0) > 0;
    },
    enabled: !!user?.id,
  });
}
