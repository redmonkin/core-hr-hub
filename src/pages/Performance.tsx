import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Target, FileText, Loader2, User, BarChart3, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GoalsManager } from "@/components/performance/GoalsManager";
import { PerformanceReviews } from "@/components/performance/PerformanceReviews";
import { PerformanceAnalytics } from "@/components/performance/PerformanceAnalytics";
import { TeamGoalsView } from "@/components/performance/TeamGoalsView";
import { TeamReviewsManager } from "@/components/performance/TeamReviewsManager";

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
            <h2 className="text-2xl font-bold text-foreground">Performance</h2>
            <p className="text-muted-foreground">Track goals and view performance reviews</p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Employee Profile</h3>
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Performance</h2>
          <p className="text-muted-foreground">
            {employeeData.isManager 
              ? "Track your goals, view reviews, and manage your team's performance"
              : "Track your goals and view performance reviews"
            }
          </p>
        </div>

        <Tabs defaultValue="goals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="goals" className="gap-2">
              <Target className="h-4 w-4" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-2">
              <FileText className="h-4 w-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            {employeeData.isManager && (
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="goals">
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Performance;
