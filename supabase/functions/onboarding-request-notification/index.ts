import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, userCan, usersWithModuleAccess } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

// Only `type` and `request_id` are used. Names, emails and messages are always
// loaded from the onboarding_requests row; any other fields sent by older
// clients (user_email, user_name, message) are ignored.
interface OnboardingRequestNotificationPayload {
  type: "submitted" | "approved" | "rejected";
  request_id: string;
}

interface OnboardingRequestRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  submission_notified_at: string | null;
}

const sendEmail = async (to: string[], subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Resend API error:", res.status, json);
  }
  return json;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase } = caller;
    console.log("Authenticated user:", userId);

    const payload: OnboardingRequestNotificationPayload = await req.json();
    const { type, request_id } = payload ?? {};
    console.log("Onboarding request notification:", { type, request_id });

    if (!request_id || typeof request_id !== "string" || !["submitted", "approved", "rejected"].includes(type)) {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    const { data: requestRow } = await supabase
      .from("onboarding_requests")
      .select("id, user_id, full_name, email, message, status, submission_notified_at")
      .eq("id", request_id)
      .maybeSingle();
    const request = requestRow as OnboardingRequestRow | null;

    if (type === "submitted") {
      // Only the applicant can trigger the submission notification for their own request
      if (!request || request.user_id !== userId) {
        console.error("User not authorized - can only notify for own onboarding request");
        return jsonResponse({ error: 'Forbidden - You can only submit notifications for your own requests' }, 403);
      }

      // Send at most once per request: claim the notification atomically
      if (request.submission_notified_at) {
        console.log("Submission notification already sent for request:", request.id);
        return jsonResponse({ success: true, already_notified: true });
      }

      const { data: claimed, error: claimError } = await supabase
        .from("onboarding_requests")
        .update({ submission_notified_at: new Date().toISOString() })
        .eq("id", request.id)
        .is("submission_notified_at", null)
        .select("id");

      if (claimError) {
        console.error("Error marking submission as notified:", claimError);
        throw new Error("Failed to record notification");
      }
      if (!claimed || claimed.length === 0) {
        console.log("Submission notification already sent for request:", request.id);
        return jsonResponse({ success: true, already_notified: true });
      }

      const userName = request.full_name;
      const userEmail = request.email;
      const message = request.message;
      const safeUserName = escapeHtml(userName);
      const safeUserEmail = escapeHtml(userEmail);
      const safeMessage = escapeHtml(message);

      // Notify everyone who can manage onboarding
      const hrUserIds = await usersWithModuleAccess(supabase, "onboarding", "manage");

      // Get notification preferences
      const { data: hrPreferences } = hrUserIds.length > 0
        ? await supabase
          .from("notification_preferences")
          .select("user_id, onboarding_notifications")
          .in("user_id", hrUserIds)
        : { data: [] };

      const hrPreferencesMap = new Map(
        (hrPreferences || []).map((p: { user_id: string; onboarding_notifications: boolean }) => [p.user_id, p.onboarding_notifications])
      );

      for (const hrUserId of hrUserIds) {
        // Create in-app notification
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: hrUserId,
            title: "New Onboarding Request",
            message: `${userName} (${userEmail}) has requested to join the organization.${message ? ` Message: "${message}"` : ""}`,
            type: "onboarding",
            link: "/onboarding-requests",
          });

        if (notifError) {
          console.error("Error creating HR notification:", notifError);
        }

        // Check if HR user wants email notifications
        const wantsOnboardingNotifications = hrPreferencesMap.get(hrUserId) ?? true;

        if (!wantsOnboardingNotifications) {
          console.log(`Skipping email for HR user ${hrUserId} - onboarding notifications disabled`);
          continue;
        }

        // Get HR user email
        const { data: hrProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", hrUserId)
          .maybeSingle();

        if (hrProfile?.email) {
          try {
            const result = await sendEmail(
              [hrProfile.email],
              `New Onboarding Request from ${safeUserName}`,
              `
                <h2>New Onboarding Request</h2>
                <p>A new user has requested to join the organization:</p>
                <ul>
                  <li><strong>Name:</strong> ${safeUserName}</li>
                  <li><strong>Email:</strong> ${safeUserEmail}</li>
                  ${safeMessage ? `<li><strong>Message:</strong> ${safeMessage}</li>` : ""}
                </ul>
                <p>Please review this request and take appropriate action.</p>
                <p>
                  <a href="${APP_URL}/onboarding" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Request</a>
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
              `
            );
            console.log("HR email sent:", result);
          } catch (err) {
            console.error("Error sending HR email:", err);
          }
        }
      }
    } else {
      // approved / rejected: only onboarding managers can send these
      if (!(await userCan(supabase, userId, "onboarding", "manage"))) {
        console.error("User not authorized - onboarding:manage required to approve/reject");
        return jsonResponse({ error: 'Forbidden - Only HR or admin can send approval/rejection notifications' }, 403);
      }

      if (!request) {
        return jsonResponse({ error: "Onboarding request not found" }, 404);
      }

      // The request must actually be in the state being announced
      if (request.status !== type) {
        console.error(`Request ${request.id} status is ${request.status}, not ${type}`);
        return jsonResponse({ error: `Onboarding request is not ${type}` }, 409);
      }

      const safeUserName = escapeHtml(request.full_name);

      // Notify the user about their request status
      const statusText = type === "approved" ? "Approved" : "Rejected";
      const statusMessage = type === "approved"
        ? "Congratulations! Your onboarding request has been approved. An HR representative will create your employee record and you'll have access to all system features shortly."
        : "We regret to inform you that your onboarding request has been rejected. Please contact HR for more information.";

      try {
        const result = await sendEmail(
          [request.email],
          `Onboarding Request ${statusText}`,
          `
            <h2>Onboarding Request ${statusText}</h2>
            <p>Hi ${safeUserName},</p>
            <p>${statusMessage}</p>
            ${type === "approved" ? `
            <p>
              <a href="${APP_URL}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Peoplo</a>
            </p>
            ` : ""}
            <p>Best regards,<br>HR Team</p>
          `
        );
        console.log(`User notification email sent (${type}):`, result);
      } catch (err) {
        console.error("Error sending user email:", err);
      }
    }

    console.log("Onboarding request notification sent successfully");

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error in onboarding-request-notification:", error);
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
