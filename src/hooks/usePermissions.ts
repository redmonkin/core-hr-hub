import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppModule,
  NO_PERMISSIONS,
  PermissionLevel,
  Permissions,
  hasAnyModuleAccess,
  hasModuleAccess,
  parsePermissions,
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
      if (error) throw error;
      return parsePermissions(data);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    retry: 3,
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
