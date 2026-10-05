import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Star, Loader2, FileText, ShieldX } from "lucide-react";
import { useAllPerformanceReviews, useCreateReview } from "@/hooks/usePerformance";
import { useEmployees } from "@/hooks/useEmployees";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";

// Quarter, half-year and annual cycles for last year and this year (e.g. "Q1 2026", "Annual 2026").
const buildReviewPeriods = () => {
  const year = new Date().getFullYear();
  return [year - 1, year].flatMap((y) => [
    `Q1 ${y}`,
    `Q2 ${y}`,
    `Q3 ${y}`,
    `Q4 ${y}`,
    `H1 ${y}`,
    `H2 ${y}`,
    `Annual ${y}`,
  ]);
};
const REVIEW_PERIODS = buildReviewPeriods();

const ReviewsManagement = () => {
  const { user } = useAuth();
  const { can, isLoading: isRoleLoading } = usePermissions();
  const canManage = can("performance", "manage");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    employee_id: "",
    review_period: "",
    review_date: new Date().toISOString().split("T")[0],
    overall_rating: 0,
    strengths: "",
    areas_for_improvement: "",
    comments: "",
    status: "draft",
  });

  const { data: reviews, isLoading } = useAllPerformanceReviews();
  const { data: employees } = useEmployees();
  const createMutation = useCreateReview();

  // Filter reviews by status
  const filteredReviews = reviews?.filter((review) =>
    statusFilter === "all" ? true : review.status === statusFilter
  );

  // Get current user's employee ID
  const { data: currentEmployee } = useQuery({
    queryKey: ["my-employee-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      review_period: "",
      review_date: new Date().toISOString().split("T")[0],
      overall_rating: 0,
      strengths: "",
      areas_for_improvement: "",
      comments: "",
      status: "draft",
    });
  };

  const handleSubmit = async () => {
    if (!formData.employee_id || !formData.review_period) return;

    await createMutation.mutateAsync({
      employee_id: formData.employee_id,
      reviewer_id: currentEmployee?.id || null,
      review_period: formData.review_period,
      review_date: formData.review_date,
      overall_rating: formData.overall_rating || null,
      strengths: formData.strengths || undefined,
      areas_for_improvement: formData.areas_for_improvement || undefined,
      comments: formData.comments || undefined,
      status: formData.status,
    });

    setIsDialogOpen(false);
    resetForm();
  };

  const renderStars = (rating: number | null) => {
    if (!rating) {
      return (
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Not rated</span>
        </span>
      );
    }
    return (
      <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${
              star <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    );
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-1" role="group" aria-labelledby="review-overall-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} of 5 stars`}
          aria-pressed={value === star}
          className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            aria-hidden="true"
            className={`h-6 w-6 ${
              star <= value ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
      )}
    </div>
  );

  if (isRoleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!can("performance", "view")) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reviews management</h1>
            <p className="text-muted-foreground">Create and manage performance reviews</p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldX className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">Access denied</h2>
              <p className="mt-2 text-muted-foreground">
                You need access to the Performance module to see all reviews.
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reviews management</h1>
            <p className="text-muted-foreground">Create and manage employee performance reviews</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Review
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredReviews && filteredReviews.length > 0 ? (
          <>
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {review.employee?.first_name?.[0]}{review.employee?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {review.employee?.first_name} {review.employee?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{review.employee?.designation}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{review.review_period}</TableCell>
                      <TableCell>{format(new Date(review.review_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{renderStars(review.overall_rating)}</TableCell>
                      <TableCell>
                        {review.reviewer 
                          ? `${review.reviewer.first_name} ${review.reviewer.last_name}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(review.status)}>
                          {formatStatus(review.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ul className="space-y-3 sm:hidden" aria-label="Performance reviews">
            {filteredReviews.map((review) => (
              <li key={review.id}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs">
                          {review.employee?.first_name?.[0]}{review.employee?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {review.employee?.first_name} {review.employee?.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{review.employee?.designation}</p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${statusBadgeClass(review.status)}`}>
                        {formatStatus(review.status)}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Period</dt>
                        <dd>{review.review_period}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Date</dt>
                        <dd>{format(new Date(review.review_date), "MMM d, yyyy")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Rating</dt>
                        <dd>{renderStars(review.overall_rating)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Reviewer</dt>
                        <dd className="truncate">
                          {review.reviewer
                            ? `${review.reviewer.first_name} ${review.reviewer.last_name}`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                {statusFilter === "all" ? "No reviews yet" : `No ${formatStatus(statusFilter).toLowerCase()} reviews`}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {statusFilter !== "all"
                  ? "Try a different status filter."
                  : canManage
                    ? "Create the first performance review to get started."
                    : "Performance reviews will appear here once they are created."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create Review Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create performance review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-employee">Employee</Label>
                  <Select
                    value={formData.employee_id}
                    onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  >
                    <SelectTrigger id="review-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-period">Review period</Label>
                  <Select
                    value={formData.review_period}
                    onValueChange={(value) => setFormData({ ...formData, review_period: value })}
                  >
                    <SelectTrigger id="review-period">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_PERIODS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-date">Review date</Label>
                  <Input
                    id="review-date"
                    type="date"
                    value={formData.review_date}
                    onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="review-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium" id="review-overall-rating">Overall rating</p>
                <StarRating
                  value={formData.overall_rating}
                  onChange={(v) => setFormData({ ...formData, overall_rating: v })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-strengths">Strengths</Label>
                <Textarea
                  id="review-strengths"
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  placeholder="What are the employee's key strengths?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-improvement">Areas for improvement</Label>
                <Textarea
                  id="review-improvement"
                  value={formData.areas_for_improvement}
                  onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                  placeholder="What areas could the employee improve?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-comments">Additional comments</Label>
                <Textarea
                  id="review-comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Any additional feedback or comments..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.employee_id || !formData.review_period || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ReviewsManagement;
