import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TeamAnalytics as TeamAnalyticsComponent } from "@/components/performance/TeamAnalytics";

const TeamAnalytics = () => {
  const { user } = useAuth();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();

  // Check if user is a manager
  const { data: managerData, isLoading: managerLoading } = useQuery({
    queryKey: ["is-manager", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Get current user's employee ID
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!employee) return null;

      // Check if they manage anyone
      const { data: managedEmployees, error } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_id", employee.id)
        .limit(1);

      if (error) throw error;

      return {
        employeeId: employee.id,
        isManager: managedEmployees && managedEmployees.length > 0,
      };
    },
    enabled: !!user?.id,
  });

  const isLoading = roleLoading || managerLoading;
  const canAccessAnalytics = isAdminOrHR || managerData?.isManager;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccessAnalytics) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Team Analytics</h2>
            <p className="text-muted-foreground">View team performance metrics and trends</p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldX className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Access Denied</h3>
              <p className="mt-2 text-muted-foreground">
                Only managers, HR, and Admin users can view team analytics.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Team Analytics</h2>
          <p className="text-muted-foreground">
            {isAdminOrHR
              ? "View organization-wide performance metrics and trends"
              : "View your team's performance metrics and trends"}
          </p>
        </div>

        <TeamAnalyticsComponent
          isManager={!isAdminOrHR && managerData?.isManager}
          managerId={managerData?.employeeId}
        />
      </div>
    </DashboardLayout>
  );
};

export default TeamAnalytics;
