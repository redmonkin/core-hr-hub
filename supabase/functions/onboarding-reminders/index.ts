import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { verifyCronSecret } from "../_shared/secrets.ts";
import { usersWithModuleAccess } from "../_shared/auth.ts";

/*
 * Daily check (pg_cron) on new hires who haven't set up their account.
 *
 * New hires can't do anything about a reminder until they have a working
 * invitation link, so nothing is sent to them. Instead, people who manage
 * onboarding get one summary when someone needs their attention: an
 * invitation link that has expired, or a new hire who was never invited.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

/** Invitation links from Supabase Auth stay valid for 24 hours. */
const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface PendingHire {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  hire_date: string | null;
}

interface Invitation {
  email: string;
  employee_id: string | null;
  created_at: string;
  last_sent_at: string | null;
  accepted_user_id: string | null;
}

const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend API error:", res.status, await res.text());
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await verifyCronSecret(req))) {
    return jsonResponse({ error: "Unauthorized - invalid cron secret" }, 401);
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: hires, error: hiresError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, hire_date")
      .eq("status", "onboarding")
      .order("hire_date");
    if (hiresError) throw hiresError;
    if (!hires || hires.length === 0) {
      return jsonResponse({ success: true, needs_attention: 0 });
    }

    const { data: invitations, error: invitesError } = await supabase
      .from("user_invitations")
      .select("email, employee_id, created_at, last_sent_at, accepted_user_id")
      .is("accepted_at", null)
      .is("revoked_at", null);
    if (invitesError) throw invitesError;

    const needsAttention = (hires as PendingHire[])
      .map((hire) => {
        const invite = (invitations as Invitation[] | null)?.find(
          (i) => i.employee_id === hire.id || i.email.toLowerCase() === hire.email.toLowerCase(),
        );
        const sentAt = invite?.last_sent_at ?? (invite?.accepted_user_id ? invite.created_at : null);
        if (!sentAt) return { hire, reason: "Not invited yet" };
        if (Date.now() - new Date(sentAt).getTime() > LINK_LIFETIME_MS) {
          return { hire, reason: `Link expired (sent ${new Date(sentAt).toDateString()})` };
        }
        return null;
      })
      .filter((x): x is { hire: PendingHire; reason: string } => x !== null);

    if (needsAttention.length === 0) {
      return jsonResponse({ success: true, needs_attention: 0 });
    }

    const names = needsAttention.map(({ hire }) => `${hire.first_name} ${hire.last_name}`);
    const summary =
      needsAttention.length === 1
        ? `${names[0]} hasn't set up their account and needs a new invitation.`
        : `${needsAttention.length} new hires haven't set up their account and need a new invitation: ${names.join(", ")}.`;

    const rows = needsAttention
      .map(
        ({ hire, reason }) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(hire.first_name)} ${escapeHtml(hire.last_name)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(hire.email)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${hire.hire_date ? escapeHtml(hire.hire_date) : "-"}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(reason)}</td>
          </tr>`,
      )
      .join("");

    const recipients = await usersWithModuleAccess(supabase, "onboarding", "manage");
    for (const userId of recipients) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "New hires need an invitation",
        message: summary,
        type: "reminder",
        link: "/onboarding?tab=pending",
      });

      if (!RESEND_API_KEY) continue;
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
      if (!profile?.email) continue;
      try {
        await sendEmail(
          profile.email,
          needsAttention.length === 1 ? `${names[0]} needs a new invitation` : `${needsAttention.length} new hires need a new invitation`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2>New hires waiting to set up their account</h2>
              <p>These people can't sign in to Peoplo yet. Resend their invitation from the Pending tab.</p>
              <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f4f4f4;">
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Name</th>
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Email</th>
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Joins</th>
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Status</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <p style="margin-top: 20px;">
                <a href="${APP_URL}/onboarding?tab=pending" style="display: inline-block; padding: 12px 24px; background-color: #0369a1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Pending</a>
              </p>
            </div>
          `,
        );
      } catch (err) {
        console.error("Error sending onboarding summary:", err);
      }
    }

    return jsonResponse({ success: true, needs_attention: needsAttention.length, notified: recipients.length });
  } catch (error) {
    console.error("Error in onboarding-reminders:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
