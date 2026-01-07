import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Starting onboarding reminders check...");

    // Find employees in onboarding status
    const { data: onboardingEmployees, error: empError } = await supabase
      .from("employees")
      .select(`
        id,
        first_name,
        last_name,
        email,
        hire_date,
        user_id,
        manager_id,
        department_id
      `)
      .eq("status", "onboarding");

    if (empError) {
      console.error("Error fetching onboarding employees:", empError);
      throw empError;
    }

    if (!onboardingEmployees || onboardingEmployees.length === 0) {
      console.log("No employees in onboarding status");
      return new Response(JSON.stringify({ success: true, reminders_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${onboardingEmployees.length} employees in onboarding`);

    let remindersSent = 0;

    for (const employee of onboardingEmployees) {
      const employeeName = `${employee.first_name} ${employee.last_name}`;
      const hireDate = new Date(employee.hire_date);
      const today = new Date();
      const daysUntilStart = Math.ceil((hireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Send reminder to employee if they have an email
      if (employee.email) {
        try {
          await sendEmail(
            [employee.email],
            "Onboarding Reminder - Complete Your Setup",
            `
              <h2>Welcome to the Team, ${employee.first_name}!</h2>
              <p>This is a friendly reminder that your onboarding process is still in progress.</p>
              ${daysUntilStart > 0 
                ? `<p>Your start date is <strong>${hireDate.toLocaleDateString()}</strong> (${daysUntilStart} days away).</p>`
                : `<p>Your start date was <strong>${hireDate.toLocaleDateString()}</strong>.</p>`
              }
              <p>Please ensure you have completed all necessary onboarding tasks:</p>
              <ul>
                <li>Complete your profile information</li>
                <li>Review company policies</li>
                <li>Set up your work accounts</li>
                <li>Complete any required training</li>
              </ul>
              <p>If you have any questions, please reach out to HR or your manager.</p>
              <p>Best regards,<br>HR Team</p>
            `
          );
          console.log(`Sent reminder to employee: ${employeeName}`);
          remindersSent++;
        } catch (err) {
          console.error(`Error sending reminder to ${employeeName}:`, err);
        }
      }

      // Create in-app notification for the employee
      if (employee.user_id) {
        await supabase.from("notifications").insert({
          user_id: employee.user_id,
          title: "Onboarding Reminder",
          message: "Please complete your onboarding tasks. Check your email for details.",
          type: "reminder",
          link: "/profile",
        });
      }

      // Notify manager if assigned
      if (employee.manager_id) {
        const { data: manager } = await supabase
          .from("employees")
          .select("user_id, email, first_name")
          .eq("id", employee.manager_id)
          .maybeSingle();

        if (manager?.user_id) {
          await supabase.from("notifications").insert({
            user_id: manager.user_id,
            title: "Onboarding Status",
            message: `${employeeName} is still completing onboarding tasks.`,
            type: "reminder",
            link: "/onboarding",
          });
        }
      }
    }

    // Notify HR about overall onboarding status
    const { data: hrUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    if (hrUsers && hrUsers.length > 0) {
      const employeeList = onboardingEmployees
        .map((e) => `${e.first_name} ${e.last_name}`)
        .join(", ");

      for (const hrUser of hrUsers) {
        await supabase.from("notifications").insert({
          user_id: hrUser.user_id,
          title: "Daily Onboarding Summary",
          message: `${onboardingEmployees.length} employee(s) pending onboarding: ${employeeList}`,
          type: "summary",
          link: "/onboarding",
        });

        // Get HR email for summary
        const { data: hrProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", hrUser.user_id)
          .maybeSingle();

        if (hrProfile?.email) {
          try {
            await sendEmail(
              [hrProfile.email],
              `Daily Onboarding Summary - ${onboardingEmployees.length} Pending`,
              `
                <h2>Daily Onboarding Summary</h2>
                <p>There are <strong>${onboardingEmployees.length}</strong> employee(s) still in onboarding:</p>
                <table style="border-collapse: collapse; width: 100%;">
                  <thead>
                    <tr style="background-color: #f4f4f4;">
                      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Name</th>
                      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Department</th>
                      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${onboardingEmployees.map((e) => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${e.first_name} ${e.last_name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">-</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(e.hire_date).toLocaleDateString()}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                <p style="margin-top: 16px;">Please follow up with these employees to complete their onboarding.</p>
              `
            );
            console.log("Sent HR summary email");
          } catch (err) {
            console.error("Error sending HR summary:", err);
          }
        }
      }
    }

    console.log(`Onboarding reminders completed. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        employees_checked: onboardingEmployees.length,
        reminders_sent: remindersSent 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in onboarding-reminders:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
