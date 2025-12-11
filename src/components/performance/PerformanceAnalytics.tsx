import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface PerformanceAnalyticsProps {
  employeeId: string;
}

export function PerformanceAnalytics({ employeeId }: PerformanceAnalyticsProps) {
  // Fetch goals for trend analysis
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["goals-analytics", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch performance reviews for rating trends
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["reviews-analytics", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("employee_id", employeeId)
        .order("review_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (goalsLoading || reviewsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Process goals data for status distribution
  const goalStatusData = goals?.reduce((acc, goal) => {
    const status = goal.status || "not_started";
    const existing = acc.find((item) => item.status === status);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ status, count: 1 });
    }
    return acc;
  }, [] as { status: string; count: number }[]) || [];

  const statusLabels: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    on_hold: "On Hold",
  };

  const statusColors: Record<string, string> = {
    not_started: "hsl(var(--muted-foreground))",
    in_progress: "hsl(var(--primary))",
    completed: "hsl(142 76% 36%)",
    on_hold: "hsl(38 92% 50%)",
  };

  // Process goals for monthly completion trend
  const monthlyGoalsTrend = goals?.reduce((acc, goal) => {
    if (goal.completed_at) {
      const month = new Date(goal.completed_at).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      const existing = acc.find((item) => item.month === month);
      if (existing) {
        existing.completed += 1;
      } else {
        acc.push({ month, completed: 1 });
      }
    }
    return acc;
  }, [] as { month: string; completed: number }[]) || [];

  // Process reviews for rating trend
  const ratingTrend = reviews?.map((review) => ({
    period: review.review_period,
    rating: review.overall_rating || 0,
    date: new Date(review.review_date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  })) || [];

  // Calculate average progress
  const avgProgress = goals?.length
    ? Math.round(
        goals.reduce((sum, goal) => sum + (goal.progress || 0), 0) / goals.length
      )
    : 0;

  // Calculate average rating
  const ratingsWithValue = reviews?.filter((r) => r.overall_rating) || [];
  const avgRating = ratingsWithValue.length
    ? (
        ratingsWithValue.reduce((sum, r) => sum + (r.overall_rating || 0), 0) /
        ratingsWithValue.length
      ).toFixed(1)
    : "N/A";

  const hasGoalData = goals && goals.length > 0;
  const hasReviewData = reviews && reviews.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{goals?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Goals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgProgress}%</div>
            <p className="text-sm text-muted-foreground">Avg. Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{reviews?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgRating}</div>
            <p className="text-sm text-muted-foreground">Avg. Rating</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Goal Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {hasGoalData ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={goalStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) =>
                      `${statusLabels[status] || status}: ${count}`
                    }
                  >
                    {goalStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={statusColors[entry.status] || "hsl(var(--muted))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      statusLabels[name as string] || name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No goals data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Rating Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Rating Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {hasReviewData && ratingTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No review data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals Completion Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Goals Completed Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyGoalsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyGoalsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="completed"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No completed goals yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
