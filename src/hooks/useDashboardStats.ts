import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useIsAdminOrHR } from "@/hooks/useUserRole";

export function useDashboardStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();

  // Subscribe to real-time changes on leave_requests
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-leave-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["dashboard-stats", user?.id, isAdminOrHR],
    queryFn: async () => {
      // For regular employees, show personal stats only
      if (!isAdminOrHR) {
        // Get current employee's data
        const { data: myEmployee } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (!myEmployee) {
          return {
            totalEmployees: null, // Don't show this for regular employees
            onLeaveToday: 0,
            assetsAssigned: 0,
            pendingPayroll: null, // Don't show this for regular employees
            pendingApprovals: 0,
            isEmployee: false,
          };
        }

        // Get my leave status for today
        const today = new Date().toISOString().split("T")[0];
        const { data: myLeaves } = await supabase
          .from("leave_requests")
          .select("id")
          .eq("employee_id", myEmployee.id)
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today);

        const amOnLeave = (myLeaves?.length || 0) > 0;

        // Calculate leave balances dynamically from leave_types and approved requests
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        // Get all leave types with their days_per_year
        const { data: leaveTypes } = await supabase
          .from("leave_types")
          .select("id, days_per_year");

        const totalLeaves = leaveTypes?.reduce((sum, lt) => sum + (lt.days_per_year || 0), 0) || 0;

        // Get approved leave requests for current year
        const { data: approvedLeaves } = await supabase
          .from("leave_requests")
          .select("days_count")
          .eq("employee_id", myEmployee.id)
          .eq("status", "approved")
          .gte("start_date", yearStart)
          .lte("start_date", yearEnd);

        const usedLeaves = approvedLeaves?.reduce((sum, r) => sum + (r.days_count || 0), 0) || 0;
        const availableLeaves = totalLeaves - usedLeaves;

        // Get my assigned assets
        const { data: myAssets } = await supabase
          .from("asset_assignments")
          .select("id")
          .eq("employee_id", myEmployee.id)
          .is("returned_date", null);

        const myAssetsCount = myAssets?.length || 0;

        // Check if I'm a manager and have pending approvals
        let pendingApprovals = 0;
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

        return {
          totalEmployees: null,
          onLeaveToday: amOnLeave ? 1 : 0,
          assetsAssigned: myAssetsCount,
          pendingPayroll: null,
          pendingApprovals,
          isEmployee: true,
          totalLeaves,
          usedLeaves,
          availableLeaves,
        };
      }

      // Admin/HR view - show organization-wide stats
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
        isEmployee: true,
      };
    },
    enabled: !!user?.id && !roleLoading,
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
