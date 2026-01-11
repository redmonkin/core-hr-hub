import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape utility to prevent XSS in email templates
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

interface OnboardingRequestNotificationPayload {
  type: "submitted" | "approved" | "rejected";
  request_id: string;
  user_email: string;
  user_name: string;
  message?: string;
}

const sendEmail = async (to: string[], subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "HR System <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  return res.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the token and get claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Invalid token:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: OnboardingRequestNotificationPayload = await req.json();
    console.log("Onboarding request notification payload:", payload);

    const { type, request_id, user_email, user_name, message } = payload;

    // Escape user-provided data for HTML
    const safeUserName = escapeHtml(user_name);
    const safeUserEmail = escapeHtml(user_email);
    const safeMessage = escapeHtml(message);

    if (type === "submitted") {
      // For submitted requests, verify the caller is the user submitting their own request
      const { data: request } = await supabase
        .from('onboarding_requests')
        .select('user_id')
        .eq('id', request_id)
        .single();

      if (!request || request.user_id !== userId) {
        console.error("User not authorized - can only notify for own onboarding request");
        return new Response(
          JSON.stringify({ error: 'Forbidden - You can only submit notifications for your own requests' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify HR users about the new request
      const { data: hrUsers, error: hrError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "hr"]);

      if (hrError) {
        console.error("Error fetching HR users:", hrError);
      }

      const hrUserIds = (hrUsers || []).map((u: { user_id: string }) => u.user_id);
      
      // Get notification preferences
      const { data: hrPreferences } = await supabase
        .from("notification_preferences")
        .select("user_id, onboarding_notifications")
        .in("user_id", hrUserIds);

      const hrPreferencesMap = new Map(
        (hrPreferences || []).map((p: { user_id: string; onboarding_notifications: boolean }) => [p.user_id, p.onboarding_notifications])
      );

      if (hrUsers && hrUsers.length > 0) {
        for (const hrUser of hrUsers) {
          // Create in-app notification
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: hrUser.user_id,
              title: "New Onboarding Request",
              message: `${user_name} (${user_email}) has requested to join the organization.${message ? ` Message: "${message}"` : ""}`,
              type: "onboarding",
              link: "/onboarding-requests",
            });

          if (notifError) {
            console.error("Error creating HR notification:", notifError);
          }

          // Check if HR user wants email notifications
          const wantsOnboardingNotifications = hrPreferencesMap.get(hrUser.user_id) ?? true;

          if (!wantsOnboardingNotifications) {
            console.log(`Skipping email for HR user ${hrUser.user_id} - onboarding notifications disabled`);
            continue;
          }

          // Get HR user email
          const { data: hrProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", hrUser.user_id)
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
                  <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
                `
              );
              console.log("HR email sent:", result);
            } catch (err) {
              console.error("Error sending HR email:", err);
            }
          }
        }
      }
    } else if (type === "approved" || type === "rejected") {
      // For approved/rejected, verify the caller is HR or admin
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'hr']);

      if (!userRoles || userRoles.length === 0) {
        console.error("User not authorized - must be HR or admin to approve/reject");
        return new Response(
          JSON.stringify({ error: 'Forbidden - Only HR or admin can send approval/rejection notifications' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify the user about their request status
      const statusText = type === "approved" ? "Approved" : "Rejected";
      const statusMessage = type === "approved" 
        ? "Congratulations! Your onboarding request has been approved. An HR representative will create your employee record and you'll have access to all system features shortly."
        : "We regret to inform you that your onboarding request has been rejected. Please contact HR for more information.";

      try {
        const result = await sendEmail(
          [user_email],
          `Onboarding Request ${statusText}`,
          `
            <h2>Onboarding Request ${statusText}</h2>
            <p>Hi ${safeUserName},</p>
            <p>${statusMessage}</p>
            <p>Best regards,<br>HR Team</p>
          `
        );
        console.log(`User notification email sent (${type}):`, result);
      } catch (err) {
        console.error("Error sending user email:", err);
      }
    }

    console.log("Onboarding request notification sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in onboarding-request-notification:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
