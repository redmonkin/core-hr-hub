import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.87.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, userCan } from "../_shared/auth.ts";

/*
 * Sends (or cancels) the invitation for an employee record.
 *
 *   { action: "invite", employee_id, redirect_url }
 *     Creates or reuses the employee's open invitation and emails a sign-up
 *     link. Calling it again resends a fresh link. If the address already
 *     belongs to an account that has been set up, the employee record is linked
 *     to it instead and no email is sent.
 *
 *   { action: "cancel", employee_id }
 *     Revokes the open invitation and deletes the account it created if that
 *     account was never used, so links already emailed stop working.
 *
 * Everything about the person (email, name, job) is read from the employee
 * record, never from the request.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

const DOMAIN_WHITELIST_MESSAGE = "Only email addresses from approved domains can be invited.";

// Allowed hosts for redirect URLs - prevents open redirect attacks.
//   - APP_URL's exact host and its subdomains
//   - localhost / 127.0.0.1 (local development)
//   - EXTRA_REDIRECT_HOSTS: optional comma-separated list of exact hosts;
//     an entry of the form "*.example.com" allows subdomains of example.com
const APP_HOSTNAME = new URL(APP_URL).hostname.toLowerCase();
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const EXTRA_REDIRECT_HOSTS = (Deno.env.get("EXTRA_REDIRECT_HOSTS") ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const isAllowedRedirectUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();

    if (host === APP_HOSTNAME || host.endsWith(`.${APP_HOSTNAME}`)) return true;
    if (LOCAL_HOSTS.includes(host)) return true;

    return EXTRA_REDIRECT_HOSTS.some((allowed) => {
      if (allowed.startsWith("*.")) {
        const base = allowed.slice(2);
        return base.length > 0 && host.endsWith(`.${base}`);
      }
      return host === allowed;
    });
  } catch {
    return false;
  }
};

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    employee_id: z.string().uuid({ message: "Invalid employee" }),
    redirect_url: z.string()
      .url({ message: "Invalid redirect URL" })
      .max(500, { message: "Redirect URL must be less than 500 characters" })
      .refine(isAllowedRedirectUrl, { message: "Redirect URL must be on an allowed domain" }),
  }),
  z.object({
    action: z.literal("cancel"),
    employee_id: z.string().uuid({ message: "Invalid employee" }),
  }),
]);

// Escape LIKE/ILIKE wildcards so an email is matched literally
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);

interface EmployeeRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  status: string;
  user_id: string | null;
  department: { name: string } | null;
}

const sendWelcomeEmail = async (
  to: string,
  firstName: string,
  designation: string | null,
  departmentName: string | undefined,
  inviteLink: string,
) => {
  const safeFirstName = escapeHtml(firstName);
  const safeDesignation = escapeHtml(designation);
  const safeDepartmentName = escapeHtml(departmentName);
  const safeInviteLink = escapeHtml(inviteLink);

  const introHtml = safeDesignation
    ? `<p>We're excited to have you join us as <strong>${safeDesignation}</strong>${safeDepartmentName ? ` in the <strong>${safeDepartmentName}</strong> team` : ""}.</p>`
    : `<p>We're excited to have you join us.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "You're invited to Peoplo: set up your account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0369a1;">Welcome aboard, ${safeFirstName}!</h1>
          ${introHtml}
          <p>Set up your account to see your profile, apply for leave, clock in and get your payslips.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeInviteLink}"
               style="background-color: #0369a1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Set up your account
            </a>
          </div>
          <p style="color: #666;">You'll choose a password on the next screen. This link expires in 24 hours; if it does, ask HR to resend it.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't expect this email, you can ignore it.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded with ${res.status}`);
  }
};

const findAccount = async (supabaseAdmin: SupabaseClient, email: string) => {
  // Every auth user has a profile row (auth.admin.listUsers() is paginated).
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", escapeLike(email))
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(data[0].id);
  if (userError || !userData?.user) return null;
  const user = userData.user;
  return { id: user.id, isSetUp: Boolean(user.email_confirmed_at || user.last_sign_in_at) };
};

const findOpenInvitation = async (supabaseAdmin: SupabaseClient, email: string) => {
  const { data, error } = await supabaseAdmin
    .from("user_invitations")
    .select("id, expires_at")
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as { id: string; expires_at: string | null }) : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase: supabaseAdmin } = caller;

    if (!(await userCan(supabaseAdmin, userId, "onboarding", "manage"))) {
      return jsonResponse({ error: "Forbidden - You do not have permission to invite employees" }, 403);
    }

    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid input", details: [{ field: "", message: "Request body must be JSON" }] }, 400);
    }
    const parsed = requestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return jsonResponse({
        error: "Invalid input",
        details: parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      }, 400);
    }
    const payload = parsed.data;

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, email, first_name, last_name, designation, status, user_id, department:departments!employees_department_id_fkey(name)")
      .eq("id", payload.employee_id)
      .maybeSingle<EmployeeRow>();
    if (employeeError) {
      console.error("Error loading employee:", employeeError);
      return jsonResponse({ error: "An unexpected error occurred" }, 500);
    }
    if (!employee) {
      return jsonResponse({ error: "Employee not found" }, 404);
    }
    const email = employee.email.trim().toLowerCase();

    // ------------------------------------------------------------ cancel
    if (payload.action === "cancel") {
      const { error: revokeError } = await supabaseAdmin
        .from("user_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("email", email)
        .is("accepted_at", null)
        .is("revoked_at", null);
      if (revokeError) {
        console.error("Error revoking invitation:", revokeError);
        return jsonResponse({ error: "An unexpected error occurred" }, 500);
      }

      // Delete the account the invitation created if it was never used, so
      // links that were already emailed stop working.
      if (employee.user_id && employee.status === "onboarding") {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(employee.user_id);
        const user = userData?.user;
        if (user && !user.email_confirmed_at && !user.last_sign_in_at) {
          await supabaseAdmin.from("employees").update({ user_id: null }).eq("id", employee.id);
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (deleteError) console.error("Error deleting unused account:", deleteError);
        }
      }
      return jsonResponse({ success: true, status: "cancelled" });
    }

    // ------------------------------------------------------------ invite
    const account = await findAccount(supabaseAdmin, email);

    // Already has a working account: link it, no invitation needed.
    if (account?.isSetUp) {
      const { data: linkedElsewhere } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("user_id", account.id)
        .neq("id", employee.id)
        .limit(1);
      if (linkedElsewhere && linkedElsewhere.length > 0) {
        return jsonResponse({ error: "This email's account is already linked to another employee record." }, 409);
      }
      const { error: linkError } = await supabaseAdmin
        .from("employees")
        .update({ user_id: account.id, ...(employee.status === "onboarding" ? { status: "active" } : {}) })
        .eq("id", employee.id);
      if (linkError) {
        console.error("Error linking existing account:", linkError);
        return jsonResponse({ error: "An unexpected error occurred" }, 500);
      }
      return jsonResponse({ success: true, status: "linked", user_id: account.id });
    }

    // Make sure there's one open, unexpired invitation for this person.
    let invitation = await findOpenInvitation(supabaseAdmin, email);
    if (invitation?.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from("user_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitation.id);
      invitation = null;
    }
    if (!invitation) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("user_invitations")
        .insert({
          email,
          full_name: `${employee.first_name} ${employee.last_name}`,
          invited_by: userId,
          roles: ["employee"],
          employee_id: employee.id,
        })
        .select("id, expires_at")
        .single();
      if (insertError) {
        if (insertError.message?.includes(DOMAIN_WHITELIST_MESSAGE)) {
          return jsonResponse({ error: DOMAIN_WHITELIST_MESSAGE }, 400);
        }
        if (insertError.code === "23505") {
          invitation = await findOpenInvitation(supabaseAdmin, email);
        }
        if (!invitation) {
          console.error("Error creating invitation:", insertError);
          return jsonResponse({ error: "Failed to create invitation" }, 500);
        }
      } else {
        invitation = inserted;
      }
    }

    const metadata = {
      full_name: `${employee.first_name} ${employee.last_name}`,
      first_name: employee.first_name,
      last_name: employee.last_name,
    };
    let invitedUserId: string | undefined;

    if (RESEND_API_KEY) {
      // One email, from us: generate the link without Supabase sending its own.
      // An account that was invited before but never set up gets a sign-in link.
      let link = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: payload.redirect_url, data: metadata },
      });
      if (link.error && account) {
        link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: payload.redirect_url },
        });
      }
      if (link.error || !link.data?.properties?.action_link) {
        console.error("Error generating invite link:", link.error);
        return jsonResponse({ error: link.error?.message ?? "Failed to create the invitation link" }, 400);
      }
      invitedUserId = link.data.user?.id;
      try {
        await sendWelcomeEmail(email, employee.first_name, employee.designation, employee.department?.name, link.data.properties.action_link);
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        return jsonResponse({ error: "The invitation email couldn't be sent. Check the email settings and try again." }, 502);
      }
    } else {
      // No Resend configured: let Supabase Auth send its own invitation email.
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: payload.redirect_url,
        data: metadata,
      });
      if (inviteError) {
        console.error("Error inviting user:", inviteError);
        return jsonResponse({ error: inviteError.message }, 400);
      }
      invitedUserId = inviteData.user?.id;
    }

    const sentAt = new Date().toISOString();
    const { data: current } = await supabaseAdmin
      .from("user_invitations")
      .select("send_count")
      .eq("id", invitation.id)
      .single();
    await supabaseAdmin
      .from("user_invitations")
      .update({ employee_id: employee.id, last_sent_at: sentAt, send_count: (current?.send_count ?? 0) + 1 })
      .eq("id", invitation.id);

    const accountId = invitedUserId ?? account?.id;
    if (accountId && !employee.user_id) {
      await supabaseAdmin.from("employees").update({ user_id: accountId }).eq("id", employee.id).is("user_id", null);
    }

    return jsonResponse({ success: true, status: "invited", user_id: accountId, sent_at: sentAt });
  } catch (error) {
    console.error("Error in invite-employee:", error);
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
