import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, FileText, Loader2, CheckCircle } from "lucide-react";
import { usePerformanceReviews, useAcknowledgeReview } from "@/hooks/usePerformance";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface PerformanceReviewsProps {
  employeeId: string;
  employeeName?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary border-primary/20",
  acknowledged: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export function PerformanceReviews({ employeeId, employeeName = "Employee" }: PerformanceReviewsProps) {
  const { user } = useAuth();
  const { data: reviews, isLoading } = usePerformanceReviews(employeeId);
  const acknowledgeMutation = useAcknowledgeReview();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">Not rated</span>;
    
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating}/5</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Performance Reviews
        </CardTitle>
        <CardDescription>View your performance evaluations</CardDescription>
      </CardHeader>
      <CardContent>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{review.review_period}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(review.review_date), "MMMM d, yyyy")}
                      {review.reviewer && (
                        <> • Reviewed by {review.reviewer.first_name} {review.reviewer.last_name}</>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusColors[review.status]}>
                    {review.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Overall Rating:</span>
                  {renderStars(review.overall_rating)}
                </div>

                {review.strengths && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-emerald-600">Strengths</p>
                    <p className="text-sm text-muted-foreground">{review.strengths}</p>
                  </div>
                )}

                {review.areas_for_improvement && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-600">Areas for Improvement</p>
                    <p className="text-sm text-muted-foreground">{review.areas_for_improvement}</p>
                  </div>
                )}

                {review.comments && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Comments</p>
                    <p className="text-sm text-muted-foreground">{review.comments}</p>
                  </div>
                )}

                {review.status === "submitted" && user && (
                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => acknowledgeMutation.mutate({ 
                        reviewId: review.id, 
                        userId: user.id,
                        employeeName,
                        reviewPeriod: review.review_period
                      })}
                      disabled={acknowledgeMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {acknowledgeMutation.isPending ? "Acknowledging..." : "Acknowledge Review"}
                    </Button>
                  </div>
                )}

                {review.acknowledged_at && (
                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 inline mr-1 text-emerald-600" />
                    Acknowledged on {format(new Date(review.acknowledged_at), "MMMM d, yyyy")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No performance reviews yet</p>
            <p className="text-sm">Reviews will appear here once completed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
