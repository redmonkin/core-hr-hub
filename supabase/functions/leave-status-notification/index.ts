import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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

interface LeaveStatusNotificationRequest {
  request_id: string;
  status: "approved" | "rejected";
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
    const payload: LeaveStatusNotificationRequest = await req.json();

    console.log("Processing leave status notification:", payload);

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

    // Get leave request with employee and leave type details
    const { data: leaveRequest, error: requestError } = await supabase
      .from("leave_requests")
      .select(`
        id,
        start_date,
        end_date,
        days_count,
        employee_id,
        leave_type_id
      `)
      .eq("id", payload.request_id)
      .single();

    if (requestError || !leaveRequest) {
      console.error("Error fetching leave request:", requestError);
      throw new Error("Leave request not found");
    }

    // Get the employee who made the leave request to check if caller is their manager
    const { data: requestEmployee } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', leaveRequest.employee_id)
      .single();

    const isManagerOfEmployee = callerEmployee && requestEmployee?.manager_id === callerEmployee.id;

    if (!isAdminOrHr && !isManagerOfEmployee) {
      console.error("User not authorized to send this notification");
      return new Response(
        JSON.stringify({ error: 'Forbidden - You are not authorized to send this notification' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get leave type name
    const { data: leaveType } = await supabase
      .from("leave_types")
      .select("name")
      .eq("id", leaveRequest.leave_type_id)
      .single();

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .eq("id", leaveRequest.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    // Check notification preferences
    let wantsLeaveStatusNotifications = true;
    if (employee.user_id) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("leave_status_notifications")
        .eq("user_id", employee.user_id)
        .maybeSingle();
      
      if (prefs) {
        wantsLeaveStatusNotifications = prefs.leave_status_notifications;
      }
    }

    console.log(`Leave status notifications preference for ${employee.email}: ${wantsLeaveStatusNotifications}`);

    const statusText = payload.status === "approved" ? "Approved" : "Rejected";
    const statusColor = payload.status === "approved" ? "#4caf50" : "#f44336";
    const leaveTypeName = leaveType?.name || "Leave";

    // Escape user-provided data for HTML
    const safeFirstName = escapeHtml(employee.first_name);
    const safeReviewerName = escapeHtml(payload.reviewer_name);
    const safeLeaveTypeName = escapeHtml(leaveTypeName);
    const safeReviewNotes = escapeHtml(payload.review_notes);

    // Create in-app notification (always send in-app notifications)
    if (employee.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: employee.user_id,
          title: `Leave Request ${statusText}`,
          message: `Your ${leaveTypeName} request for ${leaveRequest.days_count} day(s) has been ${payload.status} by ${payload.reviewer_name}.`,
          type: payload.status === "approved" ? "success" : "warning",
          link: "/leaves"
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("In-app notification created successfully");
      }
    }

    // Send email notification only if user has enabled it
    if (wantsLeaveStatusNotifications) {
      const emailResult = await sendEmail(
        [employee.email],
        `Leave Request ${statusText} - ${safeLeaveTypeName}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Leave Request ${statusText}</h2>
            <p>Hi ${safeFirstName},</p>
            <p>Your leave request has been <strong style="color: ${statusColor};">${payload.status}</strong> by ${safeReviewerName}.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
              <p style="margin: 0;"><strong>Leave Type:</strong> ${safeLeaveTypeName}</p>
              <p style="margin: 10px 0 0;"><strong>Duration:</strong> ${leaveRequest.days_count} day(s)</p>
              <p style="margin: 10px 0 0;"><strong>Dates:</strong> ${leaveRequest.start_date} to ${leaveRequest.end_date}</p>
              <p style="margin: 10px 0 0;"><strong>Status:</strong> ${statusText}</p>
              ${safeReviewNotes ? `<p style="margin: 10px 0 0;"><strong>Notes:</strong> ${safeReviewNotes}</p>` : ""}
            </div>
            
            <p>Log in to your HR portal to view more details.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
          </div>
        `
      );

      console.log("Email sent:", emailResult);
    } else {
      console.log(`Skipping email for ${employee.email} - leave status notifications disabled`);
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: wantsLeaveStatusNotifications }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in leave-status-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
