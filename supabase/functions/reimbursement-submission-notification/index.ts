import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "HR Hub <onboarding@resend.dev>";
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
  return res.json();
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReimbursementSubmissionNotificationRequest {
  request_id: string;
  employee_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
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
    const payload: ReimbursementSubmissionNotificationRequest = await req.json();

    console.log("Processing reimbursement submission notification:", payload);

    // Verify the caller is the employee submitting their own reimbursement request
    const { data: callerEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!callerEmployee || callerEmployee.id !== payload.employee_id) {
      console.error("User not authorized - can only notify for own reimbursement requests");
      return new Response(
        JSON.stringify({ error: 'Forbidden - You can only submit notifications for your own reimbursement requests' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee with manager details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, manager_id")
      .eq("id", payload.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`;
    const safeEmployeeName = escapeHtml(employeeName);
    const safeCategory = escapeHtml(payload.category);
    const safeDescription = escapeHtml(payload.description);

    // Collect recipients: the employee's manager (if any) + all HR/admin users, deduped by user_id
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

    const { data: hrUsersRaw, error: hrError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    if (hrError) {
      console.error("Error fetching HR users:", hrError);
    }

    // A user holding both admin and hr roles has two rows above with the same
    // user_id - dedupe so they don't get notified twice for one event.
    const hrUserIds = Array.from(
      new Set((hrUsersRaw || []).map((u: { user_id: string }) => u.user_id))
    );

    if (hrUserIds.length > 0) {
      const { data: hrProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", hrUserIds);

      for (const profile of hrProfiles || []) {
        recipients.push({
          user_id: profile.id,
          first_name: profile.full_name?.split(" ")[0] || "there",
          email: profile.email,
        });
      }
    }

    // Dedupe recipients (manager might also be admin/hr)
    const uniqueRecipients = Array.from(
      new Map(recipients.map((r) => [r.user_id, r])).values()
    );

    if (uniqueRecipients.length === 0) {
      console.log("No manager or HR/admin to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          message: `${employeeName} has submitted a ${payload.category} expense claim for ₹${payload.amount}.`,
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
                <p style="margin: 10px 0 0;"><strong>Amount:</strong> ₹${payload.amount}</p>
                <p style="margin: 10px 0 0;"><strong>Expense Date:</strong> ${payload.expense_date}</p>
                ${safeDescription ? `<p style="margin: 10px 0 0;"><strong>Description:</strong> ${safeDescription}</p>` : ""}
              </div>

              <p>
                <a href="https://peoplo.redmonk.in/reimbursements" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Request</a>
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

    return new Response(
      JSON.stringify({ success: true, notified: uniqueRecipients.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reimbursement-submission-notification function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
