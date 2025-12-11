import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Goal {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  progress: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  reviewer_id: string | null;
  review_period: string;
  review_date: string;
  overall_rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  comments: string | null;
  status: string;
  created_at: string;
  reviewer?: { first_name: string; last_name: string } | null;
}

export function useGoals(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["goals", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!employeeId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: {
      employee_id: string;
      title: string;
      description?: string;
      category?: string;
      priority?: string;
      due_date?: string;
    }) => {
      const { data, error } = await supabase
        .from("goals")
        .insert(goal)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.employee_id] });
      toast.success("Goal created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create goal: " + error.message);
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId, ...updates }: { id: string; employeeId: string; [key: string]: unknown }) => {
      const { error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.employeeId] });
      toast.success("Goal updated");
    },
    onError: (error) => {
      toast.error("Failed to update goal: " + error.message);
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.employeeId] });
      toast.success("Goal deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete goal: " + error.message);
    },
  });
}

export function usePerformanceReviews(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["performance-reviews", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`
          *,
          reviewer:employees!performance_reviews_reviewer_id_fkey (first_name, last_name)
        `)
        .eq("employee_id", employeeId)
        .order("review_date", { ascending: false });

      if (error) throw error;
      return data as PerformanceReview[];
    },
    enabled: !!employeeId,
  });
}

export function useAllPerformanceReviews() {
  return useQuery({
    queryKey: ["all-performance-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`
          *,
          reviewer:employees!performance_reviews_reviewer_id_fkey (first_name, last_name),
          employee:employees!performance_reviews_employee_id_fkey (id, first_name, last_name, designation)
        `)
        .order("review_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (review: {
      employee_id: string;
      reviewer_id: string | null;
      review_period: string;
      review_date: string;
      overall_rating: number | null;
      strengths?: string;
      areas_for_improvement?: string;
      comments?: string;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .insert(review)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["all-performance-reviews"] });
      toast.success("Performance review created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create review: " + error.message);
    },
  });
}
