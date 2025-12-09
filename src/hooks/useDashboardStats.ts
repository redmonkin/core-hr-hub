import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Get total employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, status");

      const totalEmployees = employees?.length || 0;
      const activeEmployees = employees?.filter((e) => e.status === "active").length || 0;

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

      return {
        totalEmployees,
        onLeaveToday,
        assetsAssigned,
        pendingPayroll,
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
