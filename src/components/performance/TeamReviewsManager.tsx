import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Star, FileText, Loader2, Plus, Users, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateReview } from "@/hooks/usePerformance";
import { format } from "date-fns";
import { toast } from "sonner";

interface TeamReviewsManagerProps {
  managerId: string;
  managerName: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  designation: string;
  avatar_url: string | null;
}

interface TeamReview {
  id: string;
  employee_id: string;
  review_period: string;
  review_date: string;
  overall_rating: number | null;
  status: string;
  employee: {
    first_name: string;
    last_name: string;
  };
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary border-primary/20",
  acknowledged: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export function TeamReviewsManager({ managerId, managerName }: TeamReviewsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    review_period: "",
    overall_rating: 0,
    strengths: "",
    areas_for_improvement: "",
    comments: "",
  });

  const createReviewMutation = useCreateReview();

  // Get team members
  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ["team-members-for-review", managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, designation, avatar_url")
        .eq("manager_id", managerId)
        .eq("status", "active");

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!managerId,
  });

  // Get existing reviews by this manager
  const { data: teamReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["team-reviews-by-manager", managerId],
    queryFn: async () => {
      if (!teamMembers || teamMembers.length === 0) return [];
      
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`
          id, employee_id, review_period, review_date, overall_rating, status,
          employee:employees!performance_reviews_employee_id_fkey (first_name, last_name)
        `)
        .eq("reviewer_id", managerId)
        .order("review_date", { ascending: false });

      if (error) throw error;
      return data as TeamReview[];
    },
    enabled: !!managerId && !!teamMembers,
  });

  const isLoading = teamLoading || reviewsLoading;

  const openCreateDialog = (employee: TeamMember) => {
    setSelectedEmployee(employee);
    setFormData({
      review_period: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
      overall_rating: 0,
      strengths: "",
      areas_for_improvement: "",
      comments: "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!selectedEmployee) return;
    if (!formData.review_period.trim()) {
      toast.error("Please enter a review period");
      return;
    }

    await createReviewMutation.mutateAsync({
      employee_id: selectedEmployee.id,
      reviewer_id: managerId,
      reviewer_name: managerName,
      review_period: formData.review_period,
      review_date: new Date().toISOString().split("T")[0],
      overall_rating: formData.overall_rating || null,
      strengths: formData.strengths || undefined,
      areas_for_improvement: formData.areas_for_improvement || undefined,
      comments: formData.comments || undefined,
      status,
    });

    setIsDialogOpen(false);
    setSelectedEmployee(null);
  };

  const renderStars = (rating: number, interactive = false, onChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
            } ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
            onClick={() => interactive && onChange?.(star)}
          />
        ))}
        {rating > 0 && <span className="ml-2 text-sm font-medium">{rating}/5</span>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!teamMembers || teamMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Team Reviews
          </CardTitle>
          <CardDescription>Create performance reviews for your team</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No team members found</p>
          <p className="text-sm">You don't have any direct reports</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Team Reviews
          </CardTitle>
          <CardDescription>Create and manage performance reviews for your team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Team Members */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Your Team</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {teamMembers.map(employee => (
                <div 
                  key={employee.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={employee.avatar_url || undefined} />
                    <AvatarFallback>
                      {employee.first_name[0]}{employee.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {employee.first_name} {employee.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {employee.designation}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openCreateDialog(employee)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Reviews */}
          {teamReviews && teamReviews.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Recent Reviews</h4>
              <div className="space-y-2">
                {teamReviews.slice(0, 5).map(review => (
                  <div 
                    key={review.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">
                          {review.employee.first_name} {review.employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {review.review_period} • {format(new Date(review.review_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.overall_rating && renderStars(review.overall_rating)}
                      <Badge variant="outline" className={statusColors[review.status]}>
                        {review.status === "acknowledged" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {review.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create Review for {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Review Period</Label>
              <Input
                value={formData.review_period}
                onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
                placeholder="e.g., Q1 2025, Annual 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Overall Rating</Label>
              {renderStars(formData.overall_rating, true, (rating) => 
                setFormData({ ...formData, overall_rating: rating })
              )}
            </div>

            <div className="space-y-2">
              <Label>Strengths</Label>
              <Textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="What does this employee do well?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Areas for Improvement</Label>
              <Textarea
                value={formData.areas_for_improvement}
                onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                placeholder="Where can they improve?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Comments</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Any other feedback..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleSubmit("draft")}
              disabled={createReviewMutation.isPending}
            >
              Save as Draft
            </Button>
            <Button 
              onClick={() => handleSubmit("submitted")}
              disabled={createReviewMutation.isPending}
            >
              {createReviewMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
