import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, getEmployeeIdForUser, usersWithModuleAccess } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

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
// (Older clients also send employee_id, category, amount etc. - ignored.)
interface ReimbursementSubmissionNotificationRequest {
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

    const payload: ReimbursementSubmissionNotificationRequest = await req.json();
    const requestId = payload?.request_id;
    console.log("Processing reimbursement submission notification:", { request_id: requestId });

    if (!requestId || typeof requestId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    const callerEmployeeId = await getEmployeeIdForUser(supabase, userId);

    const { data: reimbursement } = await supabase
      .from("reimbursement_requests")
      .select("id, employee_id, category, amount, expense_date, description, status, created_at")
      .eq("id", requestId)
      .maybeSingle();

    // Verify the request exists and belongs to the caller
    if (!callerEmployeeId || !reimbursement || reimbursement.employee_id !== callerEmployeeId) {
      console.error("User not authorized - can only notify for own reimbursement requests");
      return jsonResponse({ error: 'Forbidden - You can only submit notifications for your own reimbursement requests' }, 403);
    }

    if (reimbursement.status !== "pending" ||
        Date.now() - new Date(reimbursement.created_at).getTime() > SUBMISSION_WINDOW_MS) {
      console.log("Reimbursement is not a fresh pending request, skipping notification");
      return jsonResponse({ success: true, message: "No recipients to notify" });
    }

    // Get employee with manager details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, manager_id")
      .eq("id", reimbursement.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`;
    const category = String(reimbursement.category);
    const amount = String(reimbursement.amount);

    // Escape everything interpolated into HTML
    const safeEmployeeName = escapeHtml(employeeName);
    const safeCategory = escapeHtml(category);
    const safeDescription = escapeHtml(reimbursement.description);
    const safeAmount = escapeHtml(amount);
    const safeExpenseDate = escapeHtml(reimbursement.expense_date);

    // Collect recipients: the employee's manager (if any) + everyone who can
    // manage reimbursements, deduped by user_id
    const recipients: { user_id: string; first_name: string; email: string }[] = [];

    if (employee.manager_id) {
      const { data: manager } = await supabase
        .from("employees")
        .select("first_name, email, user_id")
        .eq("id", employee.manager_id)
        .maybeSingle();

      if (manager?.user_id) {
        recipients.push({ user_id: manager.user_id, first_name: manager.first_name, email: manager.email });
      }
    }

    const managerUserIds = await usersWithModuleAccess(supabase, "reimbursements", "manage");

    if (managerUserIds.length > 0) {
      const { data: managerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", managerUserIds);

      for (const profile of managerProfiles || []) {
        recipients.push({
          user_id: profile.id,
          first_name: profile.full_name?.split(" ")[0] || "there",
          email: profile.email,
        });
      }
    }

    // Dedupe recipients (manager might also have reimbursements:manage)
    const uniqueRecipients = Array.from(
      new Map(recipients.map((r) => [r.user_id, r])).values()
    );

    if (uniqueRecipients.length === 0) {
      console.log("No manager or reimbursement managers to notify");
      return jsonResponse({ success: true, message: "No recipients to notify" });
    }

    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, reimbursement_notifications")
      .in("user_id", uniqueRecipients.map((r) => r.user_id));

    const preferencesMap = new Map(
      (preferences || []).map((p: { user_id: string; reimbursement_notifications: boolean }) => [p.user_id, p.reimbursement_notifications])
    );

    for (const recipient of uniqueRecipients) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: recipient.user_id,
          title: "New Reimbursement Request",
          message: `${employeeName} has submitted a ${category} expense claim for ₹${amount}.`,
          type: "info",
          link: "/reimbursements",
        });

      if (notifError) {
        console.error(`Error creating notification for ${recipient.user_id}:`, notifError);
      }

      const wantsReimbursementNotifications = preferencesMap.get(recipient.user_id) ?? true;
      if (!wantsReimbursementNotifications) {
        console.log(`Skipping email for ${recipient.email} - reimbursement notifications disabled`);
        continue;
      }

      try {
        const result = await sendEmail(
          [recipient.email],
          `Reimbursement Request from ${safeEmployeeName} - Action Required`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Reimbursement Request</h2>
              <p>Hi ${escapeHtml(recipient.first_name)},</p>
              <p><strong>${safeEmployeeName}</strong> has submitted an expense claim that requires your review.</p>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <p style="margin: 0;"><strong>Category:</strong> ${safeCategory}</p>
                <p style="margin: 10px 0 0;"><strong>Amount:</strong> ₹${safeAmount}</p>
                <p style="margin: 10px 0 0;"><strong>Expense Date:</strong> ${safeExpenseDate}</p>
                ${safeDescription ? `<p style="margin: 10px 0 0;"><strong>Description:</strong> ${safeDescription}</p>` : ""}
              </div>

              <p>
                <a href="${APP_URL}/reimbursements" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Request</a>
              </p>

              <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
              <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
            </div>
          `
        );
        console.log(`Email sent to ${recipient.email}:`, result);
      } catch (err) {
        console.error(`Error sending email to ${recipient.email}:`, err);
      }
    }

    return jsonResponse({ success: true, notified: uniqueRecipients.length });
  } catch (error) {
    console.error("Error in reimbursement-submission-notification function:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
