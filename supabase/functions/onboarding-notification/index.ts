import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, userCan, usersWithModuleAccess } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

// Only employee_id is used; name, email, designation, department, join date
// and manager are loaded from the employee record (the other fields sent by
// older clients are ignored).
interface OnboardingNotificationRequest {
  employee_id: string;
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

    // Verify the caller can manage onboarding
    if (!(await userCan(supabase, userId, "onboarding", "manage"))) {
      console.error("User not authorized - onboarding:manage required");
      return jsonResponse({ error: 'Forbidden - Only HR or admin can send onboarding notifications' }, 403);
    }

    const payload: OnboardingNotificationRequest = await req.json();
    const employeeId = payload?.employee_id;
    console.log("Onboarding notification:", { employee_id: employeeId });

    if (!employeeId || typeof employeeId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    const { data: newEmployee } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, designation, department_id, hire_date, manager_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (!newEmployee) {
      return jsonResponse({ error: "Employee not found" }, 404);
    }

    let department_name: string | null = null;
    if (newEmployee.department_id) {
      const { data: department } = await supabase
        .from("departments")
        .select("name")
        .eq("id", newEmployee.department_id)
        .maybeSingle();
      department_name = department?.name ?? null;
    }

    const employee_name = `${newEmployee.first_name} ${newEmployee.last_name}`;
    const employee_email = newEmployee.email;
    const designation = newEmployee.designation;
    const join_date = String(newEmployee.hire_date ?? "");
    const manager_id = newEmployee.manager_id;

    // Escape everything interpolated into HTML
    const safeEmployeeName = escapeHtml(employee_name);
    const safeEmployeeEmail = escapeHtml(employee_email);
    const safeDesignation = escapeHtml(designation);
    const safeDepartmentName = escapeHtml(department_name);
    const safeJoinDate = escapeHtml(join_date);

    // Notify everyone who can manage onboarding
    const hrUserIds = await usersWithModuleAccess(supabase, "onboarding", "manage");
    const hrUsers = hrUserIds.map((user_id) => ({ user_id }));

    // Get notification preferences for those users
    const { data: hrPreferences } = hrUserIds.length > 0
      ? await supabase
        .from("notification_preferences")
        .select("user_id, onboarding_notifications")
        .in("user_id", hrUserIds)
      : { data: [] };

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
                <p>
                  <a href="${APP_URL}/onboarding" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Onboarding</a>
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
                <p>
                  <a href="${APP_URL}/onboarding" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Onboarding</a>
                </p>
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
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
