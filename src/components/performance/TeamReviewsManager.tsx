import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Star, FileText, Loader2, Plus, Users, CheckCircle, Edit2, Target, ListChecks, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateReview, useUpdateReview, useDeleteReview } from "@/hooks/usePerformance";
import { RatingStars } from "./RatingStars";
import { format } from "date-fns";
import { toast } from "sonner";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
import { formatPriority } from "./kpiStyles";

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
  strengths: string | null;
  areas_for_improvement: string | null;
  comments: string | null;
  status: string;
  employee: { first_name: string; last_name: string };
}

interface KpiRating {
  id: string;
  review_id: string;
  goal_id: string;
  employee_rating: number | null;
  manager_rating: number | null;
}

interface GoalInfo {
  id: string;
  title: string;
  category: string;
  priority: string;
  employee_id: string;
}

export function TeamReviewsManager({ managerId, managerName }: TeamReviewsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [editingReview, setEditingReview] = useState<TeamReview | null>(null);
  const [formData, setFormData] = useState({
    review_period: "",
    overall_rating: 0,
    strengths: "",
    areas_for_improvement: "",
    comments: "",
  });
  const [kpiManagerRatings, setKpiManagerRatings] = useState<Record<string, number>>({});
  const [bulkReviewPeriod, setBulkReviewPeriod] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const createReviewMutation = useCreateReview();
  const updateReviewMutation = useUpdateReview();
  const deleteReviewMutation = useDeleteReview();

  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ["team-members-for-review", managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, designation, avatar_url")
        .eq("manager_id", managerId).eq("status", "active");
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!managerId,
  });

  const { data: teamReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["team-reviews-by-manager", managerId],
    queryFn: async () => {
      if (!teamMembers || teamMembers.length === 0) return [];
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`id, employee_id, review_period, review_date, overall_rating, strengths, areas_for_improvement, comments, status, employee:employees!performance_reviews_employee_id_fkey (first_name, last_name)`)
        .eq("reviewer_id", managerId)
        .order("review_date", { ascending: false });
      if (error) throw error;
      return data as TeamReview[];
    },
    enabled: !!managerId && !!teamMembers,
  });

  // Fetch goals for team members
  const { data: teamGoals } = useQuery({
    queryKey: ["team-goals-for-reviews", managerId],
    queryFn: async () => {
      if (!teamMembers || teamMembers.length === 0) return [];
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, category, priority, employee_id")
        .in("employee_id", teamMembers.map(e => e.id));
      if (error) throw error;
      return data as GoalInfo[];
    },
    enabled: !!teamMembers,
  });

  // Fetch KPI ratings for the review being edited
  const { data: existingKpiRatings } = useQuery({
    queryKey: ["review-kpi-ratings-manager", editingReview?.id],
    queryFn: async () => {
      if (!editingReview) return [];
      const { data, error } = await supabase
        .from("review_kpi_ratings")
        .select("*")
        .eq("review_id", editingReview.id);
      if (error) throw error;
      return data as KpiRating[];
    },
    enabled: !!editingReview?.id,
  });

  // Save KPI ratings mutation
  const saveKpiRatings = useMutation({
    mutationFn: async ({ reviewId, ratings, employeeId }: { reviewId: string; ratings: Record<string, number>; employeeId: string }) => {
      const employeeGoals = (teamGoals || []).filter(g => g.employee_id === employeeId);
      
      for (const goal of employeeGoals) {
        const rating = ratings[goal.id];
        if (rating === undefined) continue;

        const { data: existing } = await supabase
          .from("review_kpi_ratings")
          .select("id")
          .eq("review_id", reviewId)
          .eq("goal_id", goal.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("review_kpi_ratings")
            .update({ manager_rating: rating })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("review_kpi_ratings")
            .insert({ review_id: reviewId, goal_id: goal.id, manager_rating: rating });
          if (error) throw error;
        }
      }
    },
  });

  const isLoading = teamLoading || reviewsLoading;
  const isPending = createReviewMutation.isPending || updateReviewMutation.isPending || saveKpiRatings.isPending || deleteReviewMutation.isPending;

  const resetForm = () => {
    setFormData({ review_period: "", overall_rating: 0, strengths: "", areas_for_improvement: "", comments: "" });
    setEditingReview(null);
    setSelectedEmployee(null);
    setKpiManagerRatings({});
  };

  const openCreateDialog = (employee: TeamMember) => {
    resetForm();
    setSelectedEmployee(employee);
    setFormData({
      review_period: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
      overall_rating: 0, strengths: "", areas_for_improvement: "", comments: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (review: TeamReview) => {
    setEditingReview(review);
    setSelectedEmployee({
      id: review.employee_id, first_name: review.employee.first_name,
      last_name: review.employee.last_name, designation: "", avatar_url: null,
    });
    setFormData({
      review_period: review.review_period,
      overall_rating: review.overall_rating || 0,
      strengths: review.strengths || "",
      areas_for_improvement: review.areas_for_improvement || "",
      comments: review.comments || "",
    });
    // Load existing manager ratings
    if (existingKpiRatings) {
      const ratings: Record<string, number> = {};
      existingKpiRatings.forEach(r => {
        if (r.manager_rating !== null) ratings[r.goal_id] = r.manager_rating;
      });
      setKpiManagerRatings(ratings);
    }
    setIsDialogOpen(true);
  };

  // When existingKpiRatings load for editing
  const loadRatingsForEdit = (review: TeamReview) => {
    setEditingReview(review);
    setSelectedEmployee({
      id: review.employee_id, first_name: review.employee.first_name,
      last_name: review.employee.last_name, designation: "", avatar_url: null,
    });
    setFormData({
      review_period: review.review_period,
      overall_rating: review.overall_rating || 0,
      strengths: review.strengths || "",
      areas_for_improvement: review.areas_for_improvement || "",
      comments: review.comments || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!selectedEmployee || !formData.review_period.trim()) {
      toast.error("Please enter a review period");
      return;
    }

    let reviewId: string;

    if (editingReview) {
      await updateReviewMutation.mutateAsync({
        id: editingReview.id,
        review_period: formData.review_period,
        overall_rating: formData.overall_rating || null,
        strengths: formData.strengths || undefined,
        areas_for_improvement: formData.areas_for_improvement || undefined,
        comments: formData.comments || undefined,
        status,
      });
      reviewId = editingReview.id;
    } else {
      const result = await createReviewMutation.mutateAsync({
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
      reviewId = result.id;
    }

    // Save KPI ratings
    if (Object.keys(kpiManagerRatings).length > 0) {
      await saveKpiRatings.mutateAsync({
        reviewId,
        ratings: kpiManagerRatings,
        employeeId: selectedEmployee.id,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["review-kpi-ratings"] });
    setIsDialogOpen(false);
    resetForm();
  };

  const handleBulkSubmit = async () => {
    if (bulkSelectedIds.size === 0) {
      toast.error("Please select at least one team member");
      return;
    }
    if (!bulkReviewPeriod.trim()) {
      toast.error("Please enter a review period");
      return;
    }

    const selectedMembers = teamMembers!.filter(m => bulkSelectedIds.has(m.id));
    let created = 0;
    for (const member of selectedMembers) {
      try {
        await createReviewMutation.mutateAsync({
          employee_id: member.id,
          reviewer_id: managerId,
          reviewer_name: managerName,
          review_period: bulkReviewPeriod,
          review_date: new Date().toISOString().split("T")[0],
          overall_rating: null,
          status: "draft",
        });
        created++;
      } catch (e) {
        toast.error(`Failed to create review for ${member.first_name} ${member.last_name}`);
      }
    }

    if (created > 0) {
      toast.success(`Created ${created} draft ${created === 1 ? "review" : "reviews"}`);
      queryClient.invalidateQueries({ queryKey: ["team-reviews-by-manager", managerId] });
    }
    setIsBulkDialogOpen(false);
    setBulkSelectedIds(new Set());
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!teamMembers) return;
    if (bulkSelectedIds.size === teamMembers.length) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(teamMembers.map(m => m.id)));
    }
  };

  const handleDeleteDraft = async (reviewId: string) => {
    if (confirm("Are you sure you want to delete this draft review?")) {
      await deleteReviewMutation.mutateAsync(reviewId);
      queryClient.invalidateQueries({ queryKey: ["team-reviews-by-manager", managerId] });
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-1">
      <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={`h-4 w-4 sm:h-5 sm:w-5 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </span>
      <span className="ml-1 text-sm font-medium" aria-hidden="true">{rating}/5</span>
    </div>
  );

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (!teamMembers || teamMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Team reviews</CardTitle>
          <CardDescription>Create performance reviews for your team</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Users className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>No team members found</p>
        </CardContent>
      </Card>
    );
  }

  const draftReviews = teamReviews?.filter(r => r.status === "draft") || [];
  const otherReviews = teamReviews?.filter(r => r.status !== "draft") || [];

  // Get employee goals for dialog
  const employeeGoals = selectedEmployee
    ? (teamGoals || []).filter(g => g.employee_id === selectedEmployee.id)
    : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Team reviews</CardTitle>
          <CardDescription>Create and manage performance reviews with KPI ratings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm text-muted-foreground">Your team</h4>
              <Button size="sm" variant="outline" onClick={() => { setBulkSelectedIds(new Set()); setIsBulkDialogOpen(true); }}>
                <ListChecks className="h-4 w-4 mr-1" />Bulk review
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {teamMembers.map(employee => (
                <div key={employee.id} className="flex min-w-0 items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={employee.avatar_url || undefined} />
                    <AvatarFallback>{employee.first_name[0]}{employee.last_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{employee.first_name} {employee.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{employee.designation}</p>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => openCreateDialog(employee)} aria-label={`Create review for ${employee.first_name} ${employee.last_name}`}><Plus className="h-4 w-4 mr-1" />Review</Button>
                </div>
              ))}
            </div>
          </div>

          {draftReviews.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Draft reviews</h4>
              <div className="space-y-2">
               {draftReviews.map(review => (
                   <div key={review.id} className="flex flex-col gap-3 p-3 rounded-lg border border-dashed sm:flex-row sm:items-center sm:justify-between">
                     <div className="min-w-0">
                       <p className="font-medium text-sm">{review.employee.first_name} {review.employee.last_name}</p>
                       <p className="text-xs text-muted-foreground">{review.review_period} • {format(new Date(review.review_date), "MMM d, yyyy")}</p>
                     </div>
                     <div className="flex flex-wrap items-center gap-2">
                       {review.overall_rating ? renderStars(review.overall_rating) : null}
                       <Badge variant="outline" className={statusBadgeClass(review.status)}>{formatStatus(review.status)}</Badge>
                       <Button size="sm" variant="outline" onClick={() => loadRatingsForEdit(review)} aria-label={`Edit draft review for ${review.employee.first_name} ${review.employee.last_name}`}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                       <Button size="sm" variant="outline" onClick={() => handleDeleteDraft(review.id)} disabled={isPending} aria-label={`Delete draft review for ${review.employee.first_name} ${review.employee.last_name}`}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

          {otherReviews.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Submitted reviews</h4>
              <div className="space-y-2">
                {otherReviews.slice(0, 5).map(review => (
                  <div key={review.id} className="flex flex-col gap-2 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{review.employee.first_name} {review.employee.last_name}</p>
                      <p className="text-xs text-muted-foreground">{review.review_period} • {format(new Date(review.review_date), "MMM d, yyyy")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {review.overall_rating ? renderStars(review.overall_rating) : null}
                      <Badge variant="outline" className={`whitespace-nowrap ${statusBadgeClass(review.status)}`}>
                        {review.status === "acknowledged" && <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />}{formatStatus(review.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReview ? "Edit" : "Create"} review for {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-review-period">Review period</Label>
              <Input id="team-review-period" value={formData.review_period} onChange={(e) => setFormData({ ...formData, review_period: e.target.value })} placeholder="e.g., Q1 2025, Annual 2024" />
            </div>

            {/* KPI Ratings Section */}
            {employeeGoals.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4" aria-hidden="true" />KPI ratings</p>
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Rate each KPI for this employee. Employee must submit their self-rating first.</p>
                  {employeeGoals.map((goal) => {
                    // Find existing employee rating
                    const existingRating = (existingKpiRatings || []).find(r => r.goal_id === goal.id);
                    const hasEmployeeRated = existingRating?.employee_rating !== null && existingRating?.employee_rating !== undefined;

                    return (
                      <div key={goal.id} className="p-2 rounded border bg-background space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{goal.title}</p>
                            <p className="text-xs text-muted-foreground">{goal.category} • {formatPriority(goal.priority)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground w-16">Employee:</span>
                            {hasEmployeeRated ? (
                              <RatingStars value={existingRating!.employee_rating} readonly size="sm" />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not yet rated</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground w-16">Manager:</span>
                            {hasEmployeeRated ? (
                              <RatingStars
                                value={kpiManagerRatings[goal.id] ?? existingRating?.manager_rating ?? null}
                                onChange={(r) => setKpiManagerRatings(prev => ({ ...prev, [goal.id]: r }))}
                                size="sm"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Awaiting employee</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" id="team-review-overall">Overall rating</p>
                {formData.overall_rating > 0 && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setFormData({ ...formData, overall_rating: 0 })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <RatingStars
                label="Overall"
                value={formData.overall_rating || null}
                onChange={(r) => setFormData({ ...formData, overall_rating: r })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-review-strengths">Strengths</Label>
              <Textarea id="team-review-strengths" value={formData.strengths} onChange={(e) => setFormData({ ...formData, strengths: e.target.value })} placeholder="What does this employee do well?" rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-review-improvement">Areas for improvement</Label>
              <Textarea id="team-review-improvement" value={formData.areas_for_improvement} onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })} placeholder="Where can they improve?" rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-review-comments">Additional comments</Label>
              <Textarea id="team-review-comments" value={formData.comments} onChange={(e) => setFormData({ ...formData, comments: e.target.value })} placeholder="Any other feedback..." rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleSubmit("draft")} disabled={isPending}>
              {editingReview ? "Save draft" : "Save as draft"}
            </Button>
            <Button onClick={() => handleSubmit("submitted")} disabled={isPending || formData.overall_rating === 0}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Review Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk create draft reviews</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-review-period">Review period</Label>
              <Input id="bulk-review-period" value={bulkReviewPeriod} onChange={(e) => setBulkReviewPeriod(e.target.value)} placeholder="e.g., Q1 2026, Annual 2025" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Select team members</p>
                <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
                  {bulkSelectedIds.size === (teamMembers?.length || 0) ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <div className="rounded-md border divide-y max-h-60 overflow-y-auto" tabIndex={0} role="group" aria-label="Team members">
                {teamMembers?.map(member => (
                  <label key={member.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox checked={bulkSelectedIds.has(member.id)} onCheckedChange={() => toggleBulkSelect(member.id)} />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{member.first_name[0]}{member.last_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.first_name} {member.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.designation}</p>
                    </div>
                  </label>
                ))}
              </div>
              {bulkSelectedIds.size > 0 && (
                <p className="text-xs text-muted-foreground">{bulkSelectedIds.size} {bulkSelectedIds.size === 1 ? "member" : "members"} selected</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkSubmit} disabled={isPending || bulkSelectedIds.size === 0 || !bulkReviewPeriod.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {bulkSelectedIds.size} draft{bulkSelectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
