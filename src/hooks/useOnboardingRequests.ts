import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OnboardingRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOnboardingRequests() {
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OnboardingRequest[];
    },
  });

  const approveRequest = useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      // Get request details first
      const { data: request } = await supabase
        .from("onboarding_requests")
        .select("email, full_name")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("onboarding_requests")
        .update({
          status: "approved",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      // Send notification to user
      if (request) {
        try {
          await supabase.functions.invoke("onboarding-request-notification", {
            body: {
              type: "approved",
              request_id: requestId,
              user_email: request.email,
              user_name: request.full_name,
            },
          });
        } catch (notifError) {
          console.error("Failed to send approval notification:", notifError);
        }
      }
    },
    onSuccess: () => {
      toast.success("Request approved successfully!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve request: ${error.message}`);
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      // Get request details first
      const { data: request } = await supabase
        .from("onboarding_requests")
        .select("email, full_name")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("onboarding_requests")
        .update({
          status: "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      // Send notification to user
      if (request) {
        try {
          await supabase.functions.invoke("onboarding-request-notification", {
            body: {
              type: "rejected",
              request_id: requestId,
              user_email: request.email,
              user_name: request.full_name,
            },
          });
        } catch (notifError) {
          console.error("Failed to send rejection notification:", notifError);
        }
      }
    },
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject request: ${error.message}`);
    },
  });

  return {
    requests: requestsQuery.data ?? [],
    isLoading: requestsQuery.isLoading,
    approveRequest,
    rejectRequest,
  };
}
