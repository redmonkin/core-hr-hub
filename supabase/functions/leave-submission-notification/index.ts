import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeaveSubmissionNotificationRequest {
  request_id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: LeaveSubmissionNotificationRequest = await req.json();

    console.log("Processing leave submission notification:", payload);

    // Get employee with manager details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, manager_id")
      .eq("id", payload.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    if (!employee.manager_id) {
      console.log("No manager assigned, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No manager to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get manager details
    const { data: manager, error: managerError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .eq("id", employee.manager_id)
      .single();

    if (managerError || !manager) {
      console.error("Error fetching manager:", managerError);
      throw new Error("Manager not found");
    }

    console.log("Notifying manager:", manager.email);

    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Create in-app notification for manager
    if (manager.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: manager.user_id,
          title: "New Leave Request",
          message: `${employeeName} has submitted a ${payload.leave_type} request for ${payload.days_count} day(s).`,
          type: "info",
          link: "/leave-approvals"
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("In-app notification created successfully");
      }
    }

    // Send email to manager
    const emailResult = await sendEmail(
      [manager.email],
      `Leave Request from ${employeeName} - Action Required`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Leave Request</h2>
          <p>Hi ${manager.first_name},</p>
          <p><strong>${employeeName}</strong> has submitted a leave request that requires your approval.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
            <p style="margin: 0;"><strong>Leave Type:</strong> ${payload.leave_type}</p>
            <p style="margin: 10px 0 0;"><strong>Duration:</strong> ${payload.days_count} day(s)</p>
            <p style="margin: 10px 0 0;"><strong>Dates:</strong> ${payload.start_date} to ${payload.end_date}</p>
            ${payload.reason ? `<p style="margin: 10px 0 0;"><strong>Reason:</strong> ${payload.reason}</p>` : ""}
          </div>
          
          <p>Please log in to the HR portal to review and approve/reject this request.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>HR System</p>
        </div>
      `
    );

    console.log("Email sent to manager:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailResult }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in leave-submission-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
