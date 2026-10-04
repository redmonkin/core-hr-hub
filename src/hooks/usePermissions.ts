import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppModule,
  AppRole,
  NO_PERMISSIONS,
  PermissionLevel,
  Permissions,
  hasAnyModuleAccess,
  hasModuleAccess,
  isMissingFunctionError,
  parsePermissions,
  permissionsFromRoles,
} from "@/lib/permissions";

/**
 * The signed-in user's effective module permissions (from roles and direct
 * grants). This only decides what the UI shows; the database enforces the
 * same rules with RLS.
 */
export function usePermissions() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["permissions", user?.id],
    queryFn: async (): Promise<Permissions> => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (!error) return parsePermissions(data);
      if (!isMissingFunctionError(error)) throw error;

      // The database hasn't been migrated to module permissions yet: fall
      // back to the user's roles rather than failing (or retrying forever).
      console.warn("get_my_permissions() not found; using role-based permissions until migrations are applied");
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (rolesError) throw rolesError;
      return permissionsFromRoles((roleRows ?? []).map((r) => r.role as AppRole));
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => !isMissingFunctionError(error) && failureCount < 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const perms = query.data ?? NO_PERMISSIONS;

  const can = useCallback(
    (module: AppModule, level: PermissionLevel = "view") => hasModuleAccess(perms, module, level),
    [perms]
  );

  return {
    ...perms,
    can,
    hasAnyModuleAccess: hasAnyModuleAccess(perms),
    isLoading: !!user?.id && query.isLoading,
    error: query.error,
  };
}
