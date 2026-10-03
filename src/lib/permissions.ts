import type { Database } from "@/integrations/supabase/types";

export type AppModule = Database["public"]["Enums"]["app_module"];
export type PermissionLevel = Database["public"]["Enums"]["permission_level"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Modules that access can be granted on, in display order. Each grant is
 * "view" (read across the organisation) or "manage" (edit and approve).
 * Must match the app_module enum in the database.
 */
export const MODULES: { key: AppModule; label: string; description: string }[] = [
  { key: "employees", label: "Employees", description: "Employee records, departments and documents" },
  { key: "onboarding", label: "Onboarding", description: "Invitations, onboarding requests and new joiners" },
  { key: "attendance", label: "Attendance", description: "Everyone's attendance records" },
  { key: "leaves", label: "Leaves", description: "Leave requests, leave types and balances" },
  { key: "reimbursements", label: "Reimbursements", description: "Expense claims, approvals and payouts" },
  { key: "performance", label: "Performance", description: "Reviews, goals and team analytics" },
  { key: "assets", label: "Assets", description: "Company assets and assignments" },
  { key: "payroll", label: "Payroll", description: "Salary structures, payroll runs and bank details" },
  { key: "calendar", label: "Calendar", description: "Company events and holidays" },
  { key: "settings", label: "Settings", description: "Branding, domain whitelist, office location, employee codes" },
];

export const PERMISSION_LEVELS: { key: PermissionLevel; label: string }[] = [
  { key: "view", label: "View" },
  { key: "manage", label: "Manage" },
];

const LEVEL_RANK: Record<PermissionLevel, number> = { view: 1, manage: 2 };

export type ModuleLevels = Partial<Record<AppModule, PermissionLevel>>;

export interface Permissions {
  isAdmin: boolean;
  isBlocked: boolean;
  roles: AppRole[];
  modules: ModuleLevels;
}

export const NO_PERMISSIONS: Permissions = { isAdmin: false, isBlocked: false, roles: [], modules: {} };

/** Does `granted` satisfy a requirement of `required`? */
export function levelSatisfies(granted: PermissionLevel | undefined, required: PermissionLevel): boolean {
  return granted !== undefined && LEVEL_RANK[granted] >= LEVEL_RANK[required];
}

/** Check a permission set. Admins can do everything; blocked users nothing. */
export function hasModuleAccess(perms: Permissions, module: AppModule, level: PermissionLevel = "view"): boolean {
  if (perms.isBlocked) return false;
  if (perms.isAdmin) return true;
  return levelSatisfies(perms.modules[module], level);
}

/** True if the user has been given access to at least one module. */
export function hasAnyModuleAccess(perms: Permissions): boolean {
  if (perms.isBlocked) return false;
  return perms.isAdmin || Object.keys(perms.modules).length > 0;
}

/** Parse the JSON returned by the get_my_permissions() database function. */
export function parsePermissions(raw: unknown): Permissions {
  if (!raw || typeof raw !== "object") return NO_PERMISSIONS;
  const data = raw as { is_admin?: unknown; is_blocked?: unknown; roles?: unknown; modules?: unknown };
  const validModules = new Set<string>(MODULES.map((m) => m.key));
  const modules: ModuleLevels = {};
  if (data.modules && typeof data.modules === "object") {
    for (const [key, value] of Object.entries(data.modules as Record<string, unknown>)) {
      if (validModules.has(key) && (value === "view" || value === "manage")) {
        modules[key as AppModule] = value;
      }
    }
  }
  return {
    isAdmin: data.is_admin === true,
    isBlocked: data.is_blocked === true,
    roles: Array.isArray(data.roles) ? (data.roles.filter((r) => typeof r === "string") as AppRole[]) : [],
    modules,
  };
}

/** Settings tabs are split by module: departments, leave types, organisation settings. */
export const SETTINGS_MODULES: AppModule[] = ["employees", "leaves", "settings"];

/** Can the user open Settings at all (admin, or manage on any settings module)? */
export function canAccessSettings(perms: Permissions): boolean {
  if (perms.isBlocked) return false;
  return perms.isAdmin || SETTINGS_MODULES.some((m) => hasModuleAccess(perms, m, "manage"));
}

/** Each report reads one module's data, so it's shown to people who can view that module. */
export const REPORT_MODULES: AppModule[] = ["employees", "attendance", "leaves", "payroll", "assets"];

export function canAccessReports(perms: Permissions): boolean {
  return REPORT_MODULES.some((m) => hasModuleAccess(perms, m, "view"));
}
