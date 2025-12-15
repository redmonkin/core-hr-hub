import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Get HR users to notify
    const { data: hrUsers, error: hrError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    if (hrError) {
      console.error("Error fetching HR users:", hrError);
    }

    // Create in-app notifications and send emails to HR users
    if (hrUsers && hrUsers.length > 0) {
      for (const hrUser of hrUsers) {
        // In-app notification
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
              `New Employee Onboarding: ${employee_name}`,
              `
                <h2>New Employee Added for Onboarding</h2>
                <p>A new employee has been added to the system and is ready for onboarding:</p>
                <ul>
                  <li><strong>Name:</strong> ${employee_name}</li>
                  <li><strong>Email:</strong> ${employee_email}</li>
                  <li><strong>Designation:</strong> ${designation}</li>
                  ${department_name ? `<li><strong>Department:</strong> ${department_name}</li>` : ""}
                  <li><strong>Join Date:</strong> ${join_date}</li>
                </ul>
                <p>Please ensure all onboarding tasks are completed before the join date.</p>
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
        // In-app notification for manager
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
      }

      // Email notification for manager
      if (manager?.email) {
        try {
          const result = await sendEmail(
            [manager.email],
            `New Team Member: ${employee_name}`,
            `
              <h2>New Team Member Joining</h2>
              <p>Hi ${manager.first_name},</p>
              <p>A new team member will be reporting to you:</p>
              <ul>
                <li><strong>Name:</strong> ${employee_name}</li>
                <li><strong>Email:</strong> ${employee_email}</li>
                <li><strong>Designation:</strong> ${designation}</li>
                ${department_name ? `<li><strong>Department:</strong> ${department_name}</li>` : ""}
                <li><strong>Join Date:</strong> ${join_date}</li>
              </ul>
              <p>Please prepare for their arrival and help them get started.</p>
            `
          );
          console.log("Manager email sent:", result);
        } catch (err) {
          console.error("Error sending manager email:", err);
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
