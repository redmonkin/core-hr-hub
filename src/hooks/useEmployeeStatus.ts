import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useEmployeeStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isEmployee: false, employeeId: null };

      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      return {
        isEmployee: !!data,
        employeeId: data?.id ?? null,
      };
    },
    enabled: !!user?.id,
  });
}
