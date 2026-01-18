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
      from: "HR Hub <onboarding@resend.dev>",
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

interface ReviewNotificationRequest {
  review_id: string;
  employee_id: string;
  reviewer_name: string;
  review_period: string;
  overall_rating: number | null;
  status: string;
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
    const payload: ReviewNotificationRequest = await req.json();

    console.log("Processing review notification:", payload);

    // Verify the caller is authorized (must be the reviewer, HR, or admin)
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

    // Get the review to check if caller is the reviewer
    const { data: review } = await supabase
      .from('performance_reviews')
      .select('reviewer_id')
      .eq('id', payload.review_id)
      .single();

    const isReviewer = callerEmployee && review?.reviewer_id === callerEmployee.id;

    if (!isAdminOrHr && !isReviewer) {
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
      .eq("id", payload.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    // Check notification preferences
    let wantsReviewNotifications = true;
    if (employee.user_id) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("review_notifications")
        .eq("user_id", employee.user_id)
        .maybeSingle();
      
      if (prefs) {
        wantsReviewNotifications = prefs.review_notifications;
      }
    }

    console.log(`Review notifications preference for ${employee.email}: ${wantsReviewNotifications}`);

    const ratingText = payload.overall_rating 
      ? `${payload.overall_rating}/5` 
      : "Pending";

    const statusText = payload.status === "completed" 
      ? "has been completed" 
      : payload.status === "draft" 
        ? "has been saved as a draft" 
        : "is pending your review";

    // Escape user-provided data for HTML
    const safeFirstName = escapeHtml(employee.first_name);
    const safeReviewerName = escapeHtml(payload.reviewer_name);
    const safeReviewPeriod = escapeHtml(payload.review_period);

    // Create in-app notification (always send in-app notifications)
    if (employee.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: employee.user_id,
          title: "Performance Review Submitted",
          message: `Your ${payload.review_period} performance review ${statusText}. Rating: ${ratingText}`,
          type: "info",
          link: "/performance"
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("In-app notification created successfully");
      }
    }

    // Send email notification only if user has enabled it
    if (wantsReviewNotifications) {
      const emailResult = await sendEmail(
        [employee.email],
        `Performance Review ${payload.status === "completed" ? "Completed" : "Update"} - ${safeReviewPeriod}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Performance Review ${payload.status === "completed" ? "Completed" : "Update"}</h2>
            <p>Hi ${safeFirstName},</p>
            <p>Your ${safeReviewPeriod} performance review ${statusText}.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Review Period:</strong> ${safeReviewPeriod}</p>
              <p style="margin: 10px 0 0;"><strong>Reviewer:</strong> ${safeReviewerName}</p>
              <p style="margin: 10px 0 0;"><strong>Overall Rating:</strong> ${ratingText}</p>
              <p style="margin: 10px 0 0;"><strong>Status:</strong> ${payload.status.charAt(0).toUpperCase() + payload.status.slice(1)}</p>
            </div>
            
203:             <p>
204:               <a href="https://peoplo.redmonk.in/performance" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Full Review</a>
205:             </p>
206:             <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
          </div>
        `
      );

      console.log("Email sent:", emailResult);
    } else {
      console.log(`Skipping email for ${employee.email} - review notifications disabled`);
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: wantsReviewNotifications }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in review-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
