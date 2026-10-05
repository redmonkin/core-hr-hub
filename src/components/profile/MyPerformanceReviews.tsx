import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Calendar, MessageSquare, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface MyPerformanceReviewsProps {
  employeeId: string;
}

interface PerformanceReview {
  id: string;
  review_period: string;
  review_date: string;
  overall_rating: number | null;
  status: string;
  strengths: string | null;
  areas_for_improvement: string | null;
  comments: string | null;
  acknowledged_at: string | null;
  reviewer: {
    first_name: string;
    last_name: string;
  } | null;
}

const ratingLabels: Record<number, string> = {
  1: "Needs Improvement",
  2: "Below Expectations",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

export function MyPerformanceReviews({ employeeId }: MyPerformanceReviewsProps) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["my-performance-reviews", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`
          id,
          review_period,
          review_date,
          overall_rating,
          status,
          strengths,
          areas_for_improvement,
          comments,
          acknowledged_at,
          reviewer:employees!performance_reviews_reviewer_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq("employee_id", employeeId)
        .in("status", ["submitted", "acknowledged"])
        .order("review_date", { ascending: false });

      if (error) throw error;
      return data as PerformanceReview[];
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Performance Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {ratingLabels[rating] || `${rating}/5`}
        </span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" aria-hidden="true" />
          Performance reviews
        </CardTitle>
        <CardDescription>Your performance evaluations and feedback</CardDescription>
      </CardHeader>
      <CardContent>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border p-4 space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-semibold">{review.review_period}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>{format(new Date(review.review_date), "MMM d, yyyy")}</span>
                      {review.reviewer && (
                        <>
                          <span>•</span>
                          <span>by {review.reviewer.first_name} {review.reviewer.last_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusBadgeClass(review.status)}>
                      {review.status === "acknowledged" && <CheckCircle className="mr-1 h-3 w-3" />}
                      {formatStatus(review.status)}
                    </Badge>
                  </div>
                </div>

                {review.overall_rating && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Overall rating</p>
                    {renderStars(review.overall_rating)}
                  </div>
                )}

                {review.strengths && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium">Strengths</p>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">{review.strengths}</p>
                  </div>
                )}

                {review.areas_for_improvement && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium">Areas for improvement</p>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">{review.areas_for_improvement}</p>
                  </div>
                )}

                {review.comments && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium">Additional comments</p>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">{review.comments}</p>
                  </div>
                )}

                {review.acknowledged_at && (
                  <p className="text-xs text-muted-foreground">
                    Acknowledged on {format(new Date(review.acknowledged_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No performance reviews yet</p>
            <p className="text-sm">Reviews will appear here once submitted by your manager</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
