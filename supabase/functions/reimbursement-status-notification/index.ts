import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, getEmployeeIdForUser, userCan } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
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

// Only request_id is used. Status, notes and reviewer are loaded from the
// reimbursement request row (older clients also send status, reviewer_name
// and review_notes - those are ignored).
interface ReimbursementStatusNotificationRequest {
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

    const payload: ReimbursementStatusNotificationRequest = await req.json();
    const requestId = payload?.request_id;
    console.log("Processing reimbursement status notification:", { request_id: requestId });

    if (!requestId || typeof requestId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    // Get reimbursement request
    const { data: reimbursementRequest, error: requestError } = await supabase
      .from("reimbursement_requests")
      .select("id, category, amount, expense_date, employee_id, status, review_notes, reviewed_by, paid_by")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !reimbursementRequest) {
      console.error("Error fetching reimbursement request:", requestError);
      throw new Error("Reimbursement request not found");
    }

    // Verify the caller is authorized (reimbursements:manage or the employee's manager)
    const canManage = await userCan(supabase, userId, "reimbursements", "manage");
    let isManagerOfEmployee = false;
    if (!canManage) {
      const callerEmployeeId = await getEmployeeIdForUser(supabase, userId);
      const { data: requestEmployee } = await supabase
        .from('employees')
        .select('manager_id')
        .eq('id', reimbursementRequest.employee_id)
        .maybeSingle();
      isManagerOfEmployee = !!callerEmployeeId && requestEmployee?.manager_id === callerEmployeeId;
    }

    if (!canManage && !isManagerOfEmployee) {
      console.error("User not authorized to send this notification");
      return jsonResponse({ error: 'Forbidden - You are not authorized to send this notification' }, 403);
    }

    const status = reimbursementRequest.status as string;
    if (status !== "approved" && status !== "rejected" && status !== "paid") {
      console.error(`Reimbursement ${reimbursementRequest.id} has status ${status}; nothing to notify`);
      return jsonResponse({ error: "Reimbursement request has not been reviewed" }, 409);
    }

    // Reviewer name from the acting employee's record
    let reviewerName = "HR Team";
    const actorEmployeeId = status === "paid" ? reimbursementRequest.paid_by : reimbursementRequest.reviewed_by;
    if (actorEmployeeId) {
      const { data: reviewer } = await supabase
        .from("employees")
        .select("first_name, last_name")
        .eq("id", actorEmployeeId)
        .maybeSingle();
      if (reviewer) reviewerName = `${reviewer.first_name} ${reviewer.last_name}`;
    }

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .eq("id", reimbursementRequest.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    // Check notification preferences
    let wantsReimbursementNotifications = true;
    if (employee.user_id) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("reimbursement_notifications")
        .eq("user_id", employee.user_id)
        .maybeSingle();

      if (prefs) {
        wantsReimbursementNotifications = prefs.reimbursement_notifications;
      }
    }

    console.log(`Reimbursement notifications preference for ${employee.email}: ${wantsReimbursementNotifications}`);

    const statusText = status === "approved" ? "Approved" : status === "paid" ? "Paid" : "Rejected";
    const statusColor = status === "approved" ? "#4caf50" : status === "paid" ? "#2563eb" : "#f44336";
    const category = String(reimbursementRequest.category);
    const amount = String(reimbursementRequest.amount);
    const reviewNotes = status === "paid" ? null : reimbursementRequest.review_notes;

    // Escape everything interpolated into HTML
    const safeFirstName = escapeHtml(employee.first_name);
    const safeReviewerName = escapeHtml(reviewerName);
    const safeCategory = escapeHtml(category);
    const safeReviewNotes = escapeHtml(reviewNotes);
    const safeStatus = escapeHtml(status);
    const safeAmount = escapeHtml(amount);
    const safeExpenseDate = escapeHtml(reimbursementRequest.expense_date);

    const plainMessage = `Your ${category} expense claim for ₹${amount} has been ${status} by ${reviewerName}.`;

    // Create in-app notification (always send in-app notifications)
    if (employee.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: employee.user_id,
          title: `Reimbursement Request ${statusText}`,
          message: plainMessage,
          type: status === "rejected" ? "warning" : "success",
          link: "/reimbursements"
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
            user_ids: [employee.user_id],
            title: `Reimbursement Request ${statusText}`,
            body: plainMessage,
            url: "/reimbursements",
          }),
        });
        console.log("Push notification sent");
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }
    }

    // Send email notification only if user has enabled it
    if (wantsReimbursementNotifications) {
      const emailResult = await sendEmail(
        [employee.email],
        `Reimbursement Request ${statusText} - ${safeCategory}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reimbursement Request ${statusText}</h2>
            <p>Hi ${safeFirstName},</p>
            <p>Your expense claim has been <strong style="color: ${statusColor};">${safeStatus}</strong> by ${safeReviewerName}.</p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
              <p style="margin: 0;"><strong>Category:</strong> ${safeCategory}</p>
              <p style="margin: 10px 0 0;"><strong>Amount:</strong> ₹${safeAmount}</p>
              <p style="margin: 10px 0 0;"><strong>Expense Date:</strong> ${safeExpenseDate}</p>
              <p style="margin: 10px 0 0;"><strong>Status:</strong> ${statusText}</p>
              ${safeReviewNotes ? `<p style="margin: 10px 0 0;"><strong>Notes:</strong> ${safeReviewNotes}</p>` : ""}
            </div>

            <p>
              <a href="${APP_URL}/reimbursements" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>

            <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
          </div>
        `
      );

      console.log("Email sent:", emailResult);
    } else {
      console.log(`Skipping email for ${employee.email} - reimbursement notifications disabled`);
    }

    return jsonResponse({ success: true, emailSent: wantsReimbursementNotifications });
  } catch (error) {
    console.error("Error in reimbursement-status-notification function:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
