import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Calendar, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isFuture, isWithinInterval, addDays } from "date-fns";

export function PerformanceWidget() {
  const { user } = useAuth();

  const { data: employeeData } = useQuery({
    queryKey: ["employee-for-performance", user?.id],
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

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["dashboard-goals", employeeData?.id],
    queryFn: async () => {
      if (!employeeData?.id) return [];
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employeeData.id)
        .neq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: !!employeeData?.id,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["dashboard-reviews", employeeData?.id],
    queryFn: async () => {
      if (!employeeData?.id) return [];
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("review_date", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeData?.id,
  });

  const isLoading = goalsLoading || reviewsLoading;

  // Calculate goal completion stats
  const totalGoals = goals?.length || 0;
  const avgProgress = totalGoals > 0 
    ? Math.round((goals?.reduce((sum, g) => sum + (g.progress || 0), 0) || 0) / totalGoals)
    : 0;

  // Find upcoming/recent reviews
  const upcomingReviews = reviews?.filter(r => 
    r.status === "draft" || r.status === "in_progress"
  ) || [];

  const latestCompletedReview = reviews?.find(r => r.status === "completed");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5 text-primary" />
          Performance Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Goals Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active Goals</span>
            <span className="font-medium">{totalGoals}</span>
          </div>
          <Progress value={avgProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {avgProgress}% average completion
          </p>
        </div>

        {/* Goals by status */}
        {totalGoals > 0 && (
          <div className="flex flex-wrap gap-2">
            {goals?.slice(0, 3).map((goal) => (
              <Badge 
                key={goal.id} 
                variant={goal.progress >= 75 ? "default" : "secondary"}
                className="text-xs"
              >
                {goal.title.length > 20 ? goal.title.slice(0, 20) + "..." : goal.title}
              </Badge>
            ))}
            {totalGoals > 3 && (
              <Badge variant="outline" className="text-xs">
                +{totalGoals - 3} more
              </Badge>
            )}
          </div>
        )}

        {totalGoals === 0 && (
          <p className="text-sm text-muted-foreground">No active goals set</p>
        )}

        {/* Reviews Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" />
            Reviews
          </div>

          {upcomingReviews.length > 0 ? (
            <div className="space-y-2">
              {upcomingReviews.slice(0, 2).map((review) => (
                <div key={review.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{review.review_period}</span>
                  <Badge variant="outline" className="text-xs">
                    {review.status === "draft" ? "Pending" : "In Progress"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : latestCompletedReview ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Last: {latestCompletedReview.review_period}
              </span>
              {latestCompletedReview.overall_rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium">
                    {latestCompletedReview.overall_rating}/5
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
