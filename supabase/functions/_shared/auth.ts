import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.87.1";
import { jsonResponse } from "./cors.ts";

export type AppModule =
  | "employees"
  | "onboarding"
  | "attendance"
  | "leaves"
  | "reimbursements"
  | "performance"
  | "assets"
  | "payroll"
  | "calendar"
  | "settings";

export type PermissionLevel = "view" | "manage";

export const createServiceClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

export type CallerResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; response: Response };

// Verifies the bearer JWT (auth.getClaims, as the functions always did) and
// rejects blocked users with 403. On success returns the caller's user id and
// a service-role client for data access.
export async function authenticateCaller(req: Request): Promise<CallerResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("No authorization header provided");
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.slice("Bearer ".length);
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    console.error("Invalid token:", claimsError);
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabase = createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("blocked")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Error checking caller profile:", profileError);
    return { ok: false, response: jsonResponse({ error: "An unexpected error occurred" }, 500) };
  }

  if (profile?.blocked) {
    console.error("Blocked user attempted to call function:", userId);
    return { ok: false, response: jsonResponse({ error: "Forbidden - account is blocked" }, 403) };
  }

  return { ok: true, userId, supabase };
}

// Service-role wrapper around public.user_can. Fails closed.
export async function userCan(
  supabase: SupabaseClient,
  userId: string,
  module: AppModule,
  level: PermissionLevel = "view",
): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_can", {
    _user_id: userId,
    _module: module,
    _level: level,
  });
  if (error) {
    console.error(`user_can(${module}, ${level}) failed:`, error);
    return false;
  }
  return data === true;
}

// Service-role wrapper around public.users_with_module_access. Returns
// distinct, non-blocked user ids (admins included).
export async function usersWithModuleAccess(
  supabase: SupabaseClient,
  module: AppModule,
  level: PermissionLevel = "manage",
): Promise<string[]> {
  const { data, error } = await supabase.rpc("users_with_module_access", {
    _module: module,
    _level: level,
  });
  if (error) {
    console.error(`users_with_module_access(${module}, ${level}) failed:`, error);
    return [];
  }
  const rows: unknown[] = Array.isArray(data) ? data : data == null ? [] : [data];
  const ids = rows
    .map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object") {
        const value = Object.values(row as Record<string, unknown>)[0];
        return typeof value === "string" ? value : null;
      }
      return null;
    })
    .filter((id): id is string => !!id);
  return Array.from(new Set(ids));
}

// The caller's employee record id, or null.
export async function getEmployeeIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
