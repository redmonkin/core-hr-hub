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

interface OnboardingNotificationRequest {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  designation: string;
  department_name?: string;
  join_date: string;
  manager_id?: string;
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

    // Verify the caller is HR or admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'hr']);

    if (!userRoles || userRoles.length === 0) {
      console.error("User not authorized - must be HR or admin");
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only HR or admin can send onboarding notifications' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: OnboardingNotificationRequest = await req.json();
    console.log("Onboarding notification payload:", payload);

    const {
      employee_name,
      employee_email,
      designation,
      department_name,
      join_date,
      manager_id,
    } = payload;

    // Escape user-provided data for HTML
    const safeEmployeeName = escapeHtml(employee_name);
    const safeEmployeeEmail = escapeHtml(employee_email);
    const safeDesignation = escapeHtml(designation);
    const safeDepartmentName = escapeHtml(department_name);
    const safeJoinDate = escapeHtml(join_date);

    // Get HR users to notify
    const { data: hrUsers, error: hrError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    if (hrError) {
      console.error("Error fetching HR users:", hrError);
    }

    // Get notification preferences for HR users
    const hrUserIds = (hrUsers || []).map((u: { user_id: string }) => u.user_id);
    const { data: hrPreferences } = await supabase
      .from("notification_preferences")
      .select("user_id, onboarding_notifications")
      .in("user_id", hrUserIds);

    const hrPreferencesMap = new Map(
      (hrPreferences || []).map((p: { user_id: string; onboarding_notifications: boolean }) => [p.user_id, p.onboarding_notifications])
    );

    // Create in-app notifications and send emails to HR users
    if (hrUsers && hrUsers.length > 0) {
      for (const hrUser of hrUsers) {
        // In-app notification (always send)
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: hrUser.user_id,
            title: "New Employee Onboarding",
            message: `${employee_name} has been added for onboarding as ${designation}${department_name ? ` in ${department_name}` : ""}.`,
            type: "onboarding",
            link: "/onboarding",
          });

        if (notifError) {
          console.error("Error creating HR notification:", notifError);
        }

        // Check notification preferences for email
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
              `New Employee Onboarding: ${safeEmployeeName}`,
              `
                <h2>New Employee Added for Onboarding</h2>
                <p>A new employee has been added to the system and is ready for onboarding:</p>
                <ul>
                  <li><strong>Name:</strong> ${safeEmployeeName}</li>
                  <li><strong>Email:</strong> ${safeEmployeeEmail}</li>
                  <li><strong>Designation:</strong> ${safeDesignation}</li>
                  ${safeDepartmentName ? `<li><strong>Department:</strong> ${safeDepartmentName}</li>` : ""}
                  <li><strong>Join Date:</strong> ${safeJoinDate}</li>
                </ul>
                <p>Please ensure all onboarding tasks are completed before the join date.</p>
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

    // Notify manager if assigned
    if (manager_id) {
      const { data: manager } = await supabase
        .from("employees")
        .select("user_id, email, first_name, last_name")
        .eq("id", manager_id)
        .maybeSingle();

      if (manager?.user_id) {
        // Check manager's notification preferences
        const { data: managerPrefs } = await supabase
          .from("notification_preferences")
          .select("onboarding_notifications")
          .eq("user_id", manager.user_id)
          .maybeSingle();

        const wantsOnboardingNotifications = managerPrefs?.onboarding_notifications ?? true;

        const safeManagerFirstName = escapeHtml(manager.first_name);

        // In-app notification for manager (always send)
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: manager.user_id,
            title: "New Team Member",
            message: `${employee_name} will be joining your team as ${designation} on ${join_date}.`,
            type: "onboarding",
            link: "/onboarding",
          });

        if (notifError) {
          console.error("Error creating manager notification:", notifError);
        }

        // Email notification for manager (check preferences)
        if (manager?.email && wantsOnboardingNotifications) {
          try {
            const result = await sendEmail(
              [manager.email],
              `New Team Member: ${safeEmployeeName}`,
              `
                <h2>New Team Member Joining</h2>
                <p>Hi ${safeManagerFirstName},</p>
                <p>A new team member will be reporting to you:</p>
                <ul>
                  <li><strong>Name:</strong> ${safeEmployeeName}</li>
                  <li><strong>Email:</strong> ${safeEmployeeEmail}</li>
                  <li><strong>Designation:</strong> ${safeDesignation}</li>
                  ${safeDepartmentName ? `<li><strong>Department:</strong> ${safeDepartmentName}</li>` : ""}
                  <li><strong>Join Date:</strong> ${safeJoinDate}</li>
                </ul>
                <p>Please prepare for their arrival and help them get started.</p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
              `
            );
            console.log("Manager email sent:", result);
          } catch (err) {
            console.error("Error sending manager email:", err);
          }
        } else if (!wantsOnboardingNotifications) {
          console.log(`Skipping email for manager ${manager.email} - onboarding notifications disabled`);
        }
      }
    }

    console.log("Onboarding notifications sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in onboarding-notification:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
