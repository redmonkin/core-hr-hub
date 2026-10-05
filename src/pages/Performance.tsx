import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Target, FileText, Loader2, User, BarChart3, Users, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GoalsManager } from "@/components/performance/GoalsManager";
import { PerformanceReviews } from "@/components/performance/PerformanceReviews";
import { PerformanceAnalytics } from "@/components/performance/PerformanceAnalytics";
import { TeamGoalsView } from "@/components/performance/TeamGoalsView";
import { TeamReviewsManager } from "@/components/performance/TeamReviewsManager";
import { TeamAnalytics } from "@/components/performance/TeamAnalytics";
import { cn } from "@/lib/utils";

const Performance = () => {
  const { user } = useAuth();

  // Get current employee ID, name, and check if they're a manager
  const { data: employeeData, isLoading } = useQuery({
    queryKey: ["my-employee-with-team", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: employee, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!employee) return null;

      // Check if they manage anyone
      const { data: managedEmployees } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_id", employee.id)
        .eq("status", "active")
        .limit(1);

      return {
        ...employee,
        isManager: managedEmployees && managedEmployees.length > 0,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!employeeData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Performance</h1>
            <p className="text-muted-foreground">Track KPIs and view performance reviews</p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">No employee profile</h2>
              <p className="mt-2 text-muted-foreground">
                Your account is not linked to an employee profile yet. Please contact HR.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const employeeName = `${employeeData.first_name} ${employeeData.last_name}`;

  const tabs = [
    { value: "kpis", label: "KPIs", icon: Target },
    { value: "reviews", label: "Reviews", icon: FileText },
    { value: "analytics", label: "Analytics", icon: BarChart3 },
    ...(employeeData.isManager
      ? [
          { value: "team", label: "Team", icon: Users },
          { value: "team-analytics", label: "Team Analytics", icon: TrendingUp },
        ]
      : []),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Performance</h1>
          <p className="text-muted-foreground">
            {employeeData.isManager 
              ? "Track your KPIs, view reviews, and manage your team's performance"
              : "Track your KPIs and view performance reviews"
            }
          </p>
        </div>

        <Tabs defaultValue="kpis" className="space-y-4">
          <TabsList
            className={cn(
              "grid h-auto w-full gap-1 sm:inline-flex sm:h-10 sm:w-auto",
              employeeData.isManager ? "grid-cols-5" : "grid-cols-3",
            )}
          >
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-full min-w-0 flex-col gap-1 whitespace-normal px-1 py-1.5 text-xs leading-tight sm:flex-row sm:gap-2 sm:whitespace-nowrap sm:px-3 sm:text-sm"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-center">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="kpis">
            <GoalsManager employeeId={employeeData.id} />
          </TabsContent>

          <TabsContent value="reviews">
            <PerformanceReviews 
              employeeId={employeeData.id} 
              employeeName={employeeName} 
            />
          </TabsContent>

          <TabsContent value="analytics">
            <PerformanceAnalytics employeeId={employeeData.id} />
          </TabsContent>

          {employeeData.isManager && (
            <TabsContent value="team" className="space-y-6">
              <TeamGoalsView managerId={employeeData.id} />
              <TeamReviewsManager 
                managerId={employeeData.id} 
                managerName={employeeName}
              />
            </TabsContent>
          )}

          {employeeData.isManager && (
            <TabsContent value="team-analytics">
              <TeamAnalytics
                isManager={true}
                managerId={employeeData.id}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Performance;
