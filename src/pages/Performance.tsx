import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Target, FileText, Loader2, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GoalsManager } from "@/components/performance/GoalsManager";
import { PerformanceReviews } from "@/components/performance/PerformanceReviews";

const Performance = () => {
  const { user } = useAuth();

  // Get current employee ID
  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-employee", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
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

  if (!employee) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Performance</h2>
          <p className="text-muted-foreground">Track your goals and view performance reviews</p>
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
          </TabsList>

          <TabsContent value="goals">
            <GoalsManager employeeId={employee.id} />
          </TabsContent>

          <TabsContent value="reviews">
            <PerformanceReviews employeeId={employee.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Performance;
