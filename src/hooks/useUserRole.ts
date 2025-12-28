import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type UserRoleData = {
  roles: AppRole[];
  primaryRole: AppRole | null;
};

const getPrimaryRole = (roles: AppRole[]): AppRole | null => {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hr")) return "hr";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("employee")) return "employee";
  return null;
};

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<UserRoleData | null> => {
      if (!user?.id) return null;

      // user_roles can contain multiple roles per user
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const roles = Array.from(
        new Set((data ?? []).map((r) => r.role as AppRole).filter(Boolean))
      );

      return {
        roles,
        primaryRole: getPrimaryRole(roles),
      };
    },
    enabled: !!user?.id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useIsAdminOrHR = () => {
  const { data, isLoading, error } = useUserRole();

  const roles = data?.roles ?? [];

  return {
    isAdminOrHR: roles.includes("admin") || roles.includes("hr"),
    isLoading,
    error,
    role: data?.primaryRole ?? null,
    roles,
  };
};
