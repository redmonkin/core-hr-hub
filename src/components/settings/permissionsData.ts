import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppModule, AppRole, MODULES, PermissionLevel } from "@/lib/permissions";

/** Roles whose module access is configurable (admins always have everything). */
export const CONFIGURABLE_ROLES: { key: Exclude<AppRole, "admin">; label: string }[] = [
  { key: "hr", label: "HR" },
  { key: "manager", label: "Manager" },
  { key: "employee", label: "Employee" },
];

/** "none" is the UI value for "no row". */
export type LevelChoice = PermissionLevel | "none";

export const LEVEL_CHOICES: { key: LevelChoice; label: string }[] = [
  { key: "none", label: "None" },
  { key: "view", label: "View" },
  { key: "manage", label: "Manage" },
];

const RANK: Record<LevelChoice, number> = { none: 0, view: 1, manage: 2 };

export function maxLevel(...levels: (LevelChoice | undefined)[]): LevelChoice {
  return levels.reduce<LevelChoice>((best, l) => (l && RANK[l] > RANK[best] ? l : best), "none");
}

export function levelRank(level: LevelChoice | undefined): number {
  return level ? RANK[level] : 0;
}

export function levelLabel(level: LevelChoice): string {
  return LEVEL_CHOICES.find((l) => l.key === level)?.label ?? level;
}

export function moduleLabel(module: AppModule): string {
  return MODULES.find((m) => m.key === module)?.label ?? module;
}

export interface RolePermissionRow {
  role: AppRole;
  module: AppModule;
  level: PermissionLevel;
}

export interface UserPermissionRow {
  user_id: string;
  module: AppModule;
  level: PermissionLevel;
}

export const ROLE_PERMISSIONS_KEY = ["role-permissions"] as const;
export const USER_PERMISSIONS_KEY = ["user-permissions"] as const;

/** All role defaults (admin only, enforced by RLS). */
export function useRolePermissions(enabled = true) {
  return useQuery({
    queryKey: ROLE_PERMISSIONS_KEY,
    enabled,
    queryFn: async (): Promise<RolePermissionRow[]> => {
      const { data, error } = await supabase.from("role_permissions").select("role, module, level");
      if (error) throw error;
      return (data ?? []) as RolePermissionRow[];
    },
  });
}

/** Every user's direct grants (admin only, enforced by RLS). */
export function useAllUserPermissions(enabled = true) {
  return useQuery({
    queryKey: USER_PERMISSIONS_KEY,
    enabled,
    queryFn: async (): Promise<UserPermissionRow[]> => {
      const { data, error } = await supabase.from("user_permissions").select("user_id, module, level");
      if (error) throw error;
      return (data ?? []) as UserPermissionRow[];
    },
  });
}

/** Highest level a set of roles gets on a module from the role defaults. */
export function levelFromRoles(roles: AppRole[], rolePerms: RolePermissionRow[], module: AppModule): LevelChoice {
  return maxLevel(
    ...rolePerms.filter((rp) => rp.module === module && roles.includes(rp.role)).map((rp) => rp.level)
  );
}
