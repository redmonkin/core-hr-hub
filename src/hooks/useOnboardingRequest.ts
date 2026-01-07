import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useOnboardingRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const requestQuery = useQuery({
    queryKey: ["onboarding-request", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("onboarding_requests")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const submitRequest = useMutation({
    mutationFn: async ({ message }: { message?: string }) => {
      if (!user?.id || !user?.email) throw new Error("User not authenticated");

      // Get user's full name from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("onboarding_requests").insert({
        user_id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.email.split("@")[0],
        message,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Onboarding request submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-request", user?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });

  return {
    request: requestQuery.data,
    isLoading: requestQuery.isLoading,
    submitRequest,
  };
}
