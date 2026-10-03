import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, userCan } from "../_shared/auth.ts";

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

// Input validation schema using Zod
const inviteEmployeeSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  first_name: z.string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(100, { message: "First name must be less than 100 characters" }),
  last_name: z.string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(100, { message: "Last name must be less than 100 characters" }),
  // Shown in the welcome email when given ("Resend invite" may not have one)
  designation: z.string()
    .trim()
    .max(100, { message: "Designation must be less than 100 characters" })
    .optional(),
  department_name: z.string()
    .trim()
    .max(100, { message: "Department name must be less than 100 characters" })
    .optional(),
  redirect_url: z.string()
    .url({ message: "Invalid redirect URL" })
    .max(500, { message: "Redirect URL must be less than 500 characters" })
    .refine(isAllowedRedirectUrl, {
      message: "Redirect URL must be on an allowed domain",
    }),
  mode: z.enum(["employee", "self_onboarding"]).optional().default("employee"),
});

type InviteEmployeeRequest = z.infer<typeof inviteEmployeeSchema>;

// Escape LIKE/ILIKE wildcards so an email is matched literally
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const sendWelcomeEmail = async (
  to: string,
  firstName: string,
  mode: "employee" | "self_onboarding",
  designation: string | undefined,
  departmentName: string | undefined,
  inviteLink: string
) => {
  const safeFirstName = escapeHtml(firstName);
  const safeDesignation = escapeHtml(designation);
  const safeDepartmentName = escapeHtml(departmentName);
  const safeInviteLink = escapeHtml(inviteLink);

  const introHtml = mode === "self_onboarding" || !safeDesignation
    ? mode === "self_onboarding"
      ? `<p>We're excited to have you join us. After you set up your account, you'll be asked to complete your onboarding details.</p>`
      : `<p>We're excited to have you join us.</p>`
    : `<p>We're excited to have you join us as <strong>${safeDesignation}</strong>${safeDepartmentName ? ` in the <strong>${safeDepartmentName}</strong> department` : ''}.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "Welcome to the Team! Set Up Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome Aboard, ${safeFirstName}! 🎉</h1>
          ${introHtml}
          <p>To get started, please set up your account by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeInviteLink}" 
               style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Set Up Your Account
            </a>
          </div>
          <p style="color: #666;">This link will expire in 24 hours. If you have any questions, please contact HR.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't expect this email, please ignore it or contact HR.</p>
        </div>
      `,
    }),
  });
  return res.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase: supabaseAdmin } = caller;
    console.log("Authenticated user:", userId);

    // Verify the caller can manage onboarding
    if (!(await userCan(supabaseAdmin, userId, "onboarding", "manage"))) {
      console.error("User not authorized - onboarding:manage required");
      return jsonResponse({ error: 'Forbidden - You do not have permission to invite employees' }, 403);
    }

    // Parse and validate input using Zod schema
    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid input', details: [{ field: '', message: 'Request body must be JSON' }] }, 400);
    }
    const parseResult = inviteEmployeeSchema.safeParse(rawPayload);

    if (!parseResult.success) {
      console.error("Input validation failed:", parseResult.error.errors);
      return jsonResponse({
        error: 'Invalid input',
        details: parseResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, 400);
    }

    const payload: InviteEmployeeRequest = parseResult.data;
    console.log("Invite employee payload (validated):", { email: payload.email, first_name: payload.first_name, mode: payload.mode });

    const { first_name, last_name, designation, department_name, redirect_url, mode } = payload;
    const email = payload.email.toLowerCase();
    const fullName = `${first_name} ${last_name}`;

    // Check if the user already has an account. Every auth user has a profile
    // row, so look it up there (auth.admin.listUsers() is paginated and would
    // miss accounts beyond the first page).
    const { data: existingProfiles, error: existingError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', escapeLike(email))
      .limit(1);

    if (existingError) {
      console.error("Error looking up existing user:", existingError);
      return jsonResponse({ error: "An unexpected error occurred" }, 500);
    }

    if (existingProfiles && existingProfiles.length > 0) {
      const existingUserId = existingProfiles[0].id;
      console.log("User already exists:", existingUserId);
      return jsonResponse({
        success: true,
        user_id: existingUserId,
        already_exists: true,
        invitation_id: null,
        message: "User already has an account"
      });
    }

    // Accounts are invite-only: an open invitation row must exist before the
    // auth user can be created. Reuse an existing open one if there is one.
    const findOpenInvitation = async () => {
      const { data, error } = await supabaseAdmin
        .from('user_invitations')
        .select('id, expires_at')
        .eq('email', email)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] as { id: string; expires_at: string | null } : null;
    };

    let invitationId: string | null = null;
    let createdInvitation = false;

    const existingInvitation = await findOpenInvitation();
    if (existingInvitation) {
      const expired = existingInvitation.expires_at !== null &&
        new Date(existingInvitation.expires_at).getTime() <= Date.now();
      if (!expired) {
        invitationId = existingInvitation.id;
        console.log("Reusing open invitation:", invitationId);
      } else {
        // An expired invitation still occupies the "one open invitation per
        // email" slot; revoke it so a fresh one can be created.
        const { error: revokeExpiredError } = await supabaseAdmin
          .from('user_invitations')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', existingInvitation.id);
        if (revokeExpiredError) {
          console.error("Error revoking expired invitation:", revokeExpiredError);
          return jsonResponse({ error: "An unexpected error occurred" }, 500);
        }
      }
    }

    if (!invitationId) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('user_invitations')
        .insert({
          email,
          full_name: fullName,
          invited_by: userId,
          roles: ['employee'],
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.message?.includes(DOMAIN_WHITELIST_MESSAGE)) {
          return jsonResponse({ error: DOMAIN_WHITELIST_MESSAGE }, 400);
        }
        if (insertError.code === '23505') {
          // Another request created an open invitation concurrently - reuse it
          const raced = await findOpenInvitation();
          if (raced) {
            invitationId = raced.id;
          }
        }
        if (!invitationId) {
          console.error("Error creating invitation:", insertError);
          return jsonResponse({ error: "Failed to create invitation" }, 500);
        }
      } else {
        invitationId = inserted.id;
        createdInvitation = true;
        console.log("Created invitation:", invitationId);
      }
    }

    // Invite user via Supabase Auth with validated redirect_url
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_url,
      data: {
        full_name: fullName,
        first_name,
        last_name,
      },
    });

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      if (createdInvitation && invitationId) {
        // Don't leave an unusable invitation lingering
        const { error: revokeError } = await supabaseAdmin
          .from('user_invitations')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', invitationId)
          .is('accepted_at', null);
        if (revokeError) {
          console.error("Error revoking invitation after failed invite:", revokeError);
        }
      }
      return jsonResponse({ error: inviteError.message }, 400);
    }

    console.log("User invited successfully:", inviteData.user?.id);

    // Send custom welcome email with Resend (more customizable than Supabase's default)
    if (RESEND_API_KEY) {
      try {
        // Generate a magic link for the user
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo: redirect_url,
            data: {
              full_name: fullName,
              first_name,
              last_name,
            },
          },
        });

        if (!linkError && linkData?.properties?.action_link) {
          await sendWelcomeEmail(
            email,
            first_name,
            mode,
            designation,
            department_name,
            linkData.properties.action_link
          );
          console.log("Custom welcome email sent");
        } else if (linkError) {
          console.error("Error generating invite link:", linkError);
        }
      } catch (emailErr) {
        console.error("Error sending custom email:", emailErr);
        // Don't fail the request - Supabase will have sent its own invite email
      }
    }

    return jsonResponse({
      success: true,
      user_id: inviteData.user?.id,
      already_exists: false,
      invitation_id: invitationId,
      message: "Invitation sent successfully"
    });
  } catch (error) {
    console.error("Error in invite-employee:", error);
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
