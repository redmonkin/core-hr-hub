import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, getEmployeeIdForUser } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Submission notifications are only sent shortly after the request is created,
// so the endpoint can't be used to re-send old requests over and over.
const SUBMISSION_WINDOW_MS = 15 * 60 * 1000;

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

// Only request_id is used; everything else is loaded from the database.
// (Older clients also send employee_id, leave_type, dates etc. - ignored.)
interface LeaveSubmissionNotificationRequest {
  request_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase } = caller;
    console.log("Authenticated user:", userId);

    const payload: LeaveSubmissionNotificationRequest = await req.json();
    const requestId = payload?.request_id;
    console.log("Processing leave submission notification:", { request_id: requestId });

    if (!requestId || typeof requestId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    const callerEmployeeId = await getEmployeeIdForUser(supabase, userId);

    const { data: leaveRequest } = await supabase
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status, created_at")
      .eq("id", requestId)
      .maybeSingle();

    // Verify the leave request exists and belongs to the caller
    if (!callerEmployeeId || !leaveRequest || leaveRequest.employee_id !== callerEmployeeId) {
      console.error("User not authorized - can only notify for own leave requests");
      return jsonResponse({ error: 'Forbidden - You can only submit notifications for your own leave requests' }, 403);
    }

    if (leaveRequest.status !== "pending" ||
        Date.now() - new Date(leaveRequest.created_at).getTime() > SUBMISSION_WINDOW_MS) {
      console.log("Leave request is not a fresh pending request, skipping notification");
      return jsonResponse({ success: true, message: "Nothing to notify" });
    }

    // Get employee with manager details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, manager_id")
      .eq("id", leaveRequest.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    if (!employee.manager_id) {
      console.log("No manager assigned, skipping notification");
      return jsonResponse({ success: true, message: "No manager to notify" });
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

    const { data: leaveType } = await supabase
      .from("leave_types")
      .select("name")
      .eq("id", leaveRequest.leave_type_id)
      .maybeSingle();

    console.log("Notifying manager:", manager.email);

    const employeeName = `${employee.first_name} ${employee.last_name}`;
    const leaveTypeName = leaveType?.name || "Leave";
    const daysCount = String(leaveRequest.days_count);

    // Escape everything interpolated into HTML
    const safeEmployeeName = escapeHtml(employeeName);
    const safeManagerFirstName = escapeHtml(manager.first_name);
    const safeLeaveType = escapeHtml(leaveTypeName);
    const safeReason = escapeHtml(leaveRequest.reason);
    const safeDaysCount = escapeHtml(daysCount);
    const safeStartDate = escapeHtml(leaveRequest.start_date);
    const safeEndDate = escapeHtml(leaveRequest.end_date);

    const plainMessage = `${employeeName} has submitted a ${leaveTypeName} request for ${daysCount} day(s).`;

    // Create in-app notification for manager
    if (manager.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: manager.user_id,
          title: "New Leave Request",
          message: plainMessage,
          type: "info",
          link: "/leave-approvals"
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("In-app notification created successfully");
      }

      // Send push notification
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_ids: [manager.user_id],
            title: "New Leave Request",
            body: plainMessage,
            url: "/leaves",
          }),
        });
        console.log("Push notification sent to manager");
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }
    }

    // Send email to manager
    const emailResult = await sendEmail(
      [manager.email],
      `Leave Request from ${safeEmployeeName} - Action Required`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Leave Request</h2>
          <p>Hi ${safeManagerFirstName},</p>
          <p><strong>${safeEmployeeName}</strong> has submitted a leave request that requires your approval.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
            <p style="margin: 0;"><strong>Leave Type:</strong> ${safeLeaveType}</p>
            <p style="margin: 10px 0 0;"><strong>Duration:</strong> ${safeDaysCount} day(s)</p>
            <p style="margin: 10px 0 0;"><strong>Dates:</strong> ${safeStartDate} to ${safeEndDate}</p>
            ${safeReason ? `<p style="margin: 10px 0 0;"><strong>Reason:</strong> ${safeReason}</p>` : ""}
          </div>
          
          <p>
            <a href="${APP_URL}/leaves" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Request</a>
          </p>
          
          <p style="margin-top: 30px;">Best regards,<br>HR System</p>
        </div>
      `
    );

    console.log("Email sent to manager:", emailResult);

    return jsonResponse({ success: true, emailResult });
  } catch (error) {
    console.error("Error in leave-submission-notification function:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
