import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReimbursementStatusNotificationRequest {
  request_id: string;
  status: "approved" | "rejected" | "paid";
  reviewer_name: string;
  review_notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const payload: ReimbursementStatusNotificationRequest = await req.json();

    console.log("Processing reimbursement status notification:", payload);

    // Verify the caller is authorized (must be HR/admin or the manager of the employee)
    const { data: callerEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Check if user is admin/HR
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'hr']);

    const isAdminOrHr = userRoles && userRoles.length > 0;

    // Get reimbursement request with employee details
    const { data: reimbursementRequest, error: requestError } = await supabase
      .from("reimbursement_requests")
      .select("id, category, amount, expense_date, employee_id")
      .eq("id", payload.request_id)
      .single();

    if (requestError || !reimbursementRequest) {
      console.error("Error fetching reimbursement request:", requestError);
      throw new Error("Reimbursement request not found");
    }

    // Get the employee who made the request to check if caller is their manager
    const { data: requestEmployee } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', reimbursementRequest.employee_id)
      .single();

    const isManagerOfEmployee = callerEmployee && requestEmployee?.manager_id === callerEmployee.id;

    if (!isAdminOrHr && !isManagerOfEmployee) {
      console.error("User not authorized to send this notification");
      return new Response(
        JSON.stringify({ error: 'Forbidden - You are not authorized to send this notification' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const statusText = payload.status === "approved" ? "Approved" : payload.status === "paid" ? "Paid" : "Rejected";
    const statusColor = payload.status === "approved" ? "#4caf50" : payload.status === "paid" ? "#2563eb" : "#f44336";

    // Escape user-provided data for HTML
    const safeFirstName = escapeHtml(employee.first_name);
    const safeReviewerName = escapeHtml(payload.reviewer_name);
    const safeCategory = escapeHtml(reimbursementRequest.category);
    const safeReviewNotes = escapeHtml(payload.review_notes);

    // Create in-app notification (always send in-app notifications)
    if (employee.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: employee.user_id,
          title: `Reimbursement Request ${statusText}`,
          message: `Your ${reimbursementRequest.category} expense claim for ₹${reimbursementRequest.amount} has been ${payload.status} by ${payload.reviewer_name}.`,
          type: payload.status === "rejected" ? "warning" : "success",
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
            body: `Your ${reimbursementRequest.category} expense claim for ₹${reimbursementRequest.amount} has been ${payload.status} by ${payload.reviewer_name}.`,
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
            <p>Your expense claim has been <strong style="color: ${statusColor};">${payload.status}</strong> by ${safeReviewerName}.</p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
              <p style="margin: 0;"><strong>Category:</strong> ${safeCategory}</p>
              <p style="margin: 10px 0 0;"><strong>Amount:</strong> ₹${reimbursementRequest.amount}</p>
              <p style="margin: 10px 0 0;"><strong>Expense Date:</strong> ${reimbursementRequest.expense_date}</p>
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

    return new Response(
      JSON.stringify({ success: true, emailSent: wantsReimbursementNotifications }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reimbursement-status-notification function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
