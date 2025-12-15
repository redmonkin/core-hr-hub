import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      // Get total employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, status");

      const totalEmployees = employees?.length || 0;

      // Get today's leave count
      const today = new Date().toISOString().split("T")[0];
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

      const onLeaveToday = leaves?.length || 0;

      // Get assigned assets count
      const { data: assets } = await supabase
        .from("assets")
        .select("id")
        .eq("status", "assigned");

      const assetsAssigned = assets?.length || 0;

      // Get pending payroll amount
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: payroll } = await supabase
        .from("payroll_records")
        .select("net_salary")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("status", "draft");

      const pendingPayroll = payroll?.reduce((sum, r) => sum + Number(r.net_salary), 0) || 0;

      // Get pending approvals for manager
      let pendingApprovals = 0;
      if (user?.id) {
        const { data: myEmployee } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (myEmployee) {
          const { data: directReports } = await supabase
            .from("employees")
            .select("id")
            .eq("manager_id", myEmployee.id);

          if (directReports && directReports.length > 0) {
            const reportIds = directReports.map((r) => r.id);
            const { count } = await supabase
              .from("leave_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
              .in("employee_id", reportIds);

            pendingApprovals = count || 0;
          }
        }
      }

      return {
        totalEmployees,
        onLeaveToday,
        assetsAssigned,
        pendingPayroll,
        pendingApprovals,
      };
    },
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          id,
          action,
          entity_type,
          details,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });
}
