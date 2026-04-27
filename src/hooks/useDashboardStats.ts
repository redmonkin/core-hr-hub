import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useIsAdminOrHR } from "@/hooks/useUserRole";

async function getEligibleLeaveTotals(employeeId: string, currentYear: number) {
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const { data: eligibility } = await supabase
    .from("employee_leave_eligibility")
    .select("leave_type_id")
    .eq("employee_id", employeeId);

  const eligibleLeaveTypeIds = (eligibility || []).map((row) => row.leave_type_id);

  if (eligibleLeaveTypeIds.length === 0) {
    return { totalLeaves: 0, usedLeaves: 0, availableLeaves: 0 };
  }

  const { data: leaveTypes } = await supabase
    .from("leave_types")
    .select("id, days_per_year")
    .in("id", eligibleLeaveTypeIds);

  const totalLeaves = leaveTypes?.reduce((sum, lt) => sum + (lt.days_per_year || 0), 0) || 0;

  const { data: approvedLeaves } = await supabase
    .from("leave_requests")
    .select("days_count")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .in("leave_type_id", eligibleLeaveTypeIds)
    .gte("start_date", yearStart)
    .lte("start_date", yearEnd);

  const usedLeaves = approvedLeaves?.reduce((sum, r) => sum + (r.days_count || 0), 0) || 0;
  const availableLeaves = Math.max(totalLeaves - usedLeaves, 0);

  return { totalLeaves, usedLeaves, availableLeaves };
}

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
        const { totalLeaves, usedLeaves, availableLeaves } = await getEligibleLeaveTotals(myEmployee.id, currentYear);

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

      // Admin/HR view - fetch personal stats same as employees
      const { data: myEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!myEmployee) {
        return {
          totalEmployees: null,
          onLeaveToday: 0,
          assetsAssigned: 0,
          pendingPayroll: null,
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

      // Calculate leave balances dynamically
      const currentYear = new Date().getFullYear();
      const { totalLeaves, usedLeaves, availableLeaves } = await getEligibleLeaveTotals(myEmployee.id, currentYear);

      // Get my assigned assets
      const { data: myAssets } = await supabase
        .from("asset_assignments")
        .select("id")
        .eq("employee_id", myEmployee.id)
        .is("returned_date", null);

      const myAssetsCount = myAssets?.length || 0;

      // Check pending approvals
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
