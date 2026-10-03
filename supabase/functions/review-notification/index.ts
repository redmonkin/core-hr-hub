import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, getEmployeeIdForUser, userCan } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;

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

// review_id identifies the review; everything in the notification comes from
// the review row. employee_id, if sent, must match the review's employee.
// (reviewer_name, review_period, overall_rating and status from older clients
// are ignored.)
interface ReviewNotificationRequest {
  review_id: string;
  employee_id?: string;
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

    const payload: ReviewNotificationRequest = await req.json();
    const reviewId = payload?.review_id;
    console.log("Processing review notification:", { review_id: reviewId });

    if (!reviewId || typeof reviewId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    const { data: review } = await supabase
      .from('performance_reviews')
      .select('id, employee_id, reviewer_id, review_period, overall_rating, status')
      .eq('id', reviewId)
      .maybeSingle();

    // Verify the caller is authorized (the reviewer, or performance:manage)
    const callerEmployeeId = await getEmployeeIdForUser(supabase, userId);
    const isReviewer = !!callerEmployeeId && !!review && review.reviewer_id === callerEmployeeId;
    const canManagePerformance = isReviewer
      ? false
      : await userCan(supabase, userId, "performance", "manage");

    if (!review || (!isReviewer && !canManagePerformance)) {
      console.error("User not authorized to send this notification");
      return jsonResponse({ error: 'Forbidden - You are not authorized to send this notification' }, 403);
    }

    if (payload.employee_id !== undefined && payload.employee_id !== review.employee_id) {
      console.error("employee_id does not match the review");
      return jsonResponse({ error: "employee_id does not match the review" }, 400);
    }

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .eq("id", review.employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      throw new Error("Employee not found");
    }

    // Reviewer name from the reviewer's employee record
    let reviewerName = "HR Team";
    if (review.reviewer_id) {
      const { data: reviewer } = await supabase
        .from("employees")
        .select("first_name, last_name")
        .eq("id", review.reviewer_id)
        .maybeSingle();
      if (reviewer) reviewerName = `${reviewer.first_name} ${reviewer.last_name}`;
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

    const status = String(review.status ?? "");

    // Drafts are private to the reviewer until submitted; don't tell the
    // employee (or reveal the rating) yet.
    if (status === "draft") {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Draft reviews are not notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reviewPeriod = String(review.review_period ?? "");

    const ratingText = review.overall_rating 
      ? `${review.overall_rating}/5` 
      : "Pending";

    const statusText = status === "completed" 
      ? "has been completed" 
      : status === "draft" 
        ? "has been saved as a draft" 
        : "is pending your review";

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const headline = status === "completed" ? "Completed" : "Update";

    // Escape everything interpolated into HTML
    const safeFirstName = escapeHtml(employee.first_name);
    const safeReviewerName = escapeHtml(reviewerName);
    const safeReviewPeriod = escapeHtml(reviewPeriod);
    const safeRatingText = escapeHtml(ratingText);
    const safeStatusLabel = escapeHtml(statusLabel);

    // Create in-app notification (always send in-app notifications)
    if (employee.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: employee.user_id,
          title: "Performance Review Submitted",
          message: `Your ${reviewPeriod} performance review ${statusText}. Rating: ${ratingText}`,
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
        `Performance Review ${headline} - ${safeReviewPeriod}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Performance Review ${headline}</h2>
            <p>Hi ${safeFirstName},</p>
            <p>Your ${safeReviewPeriod} performance review ${statusText}.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Review Period:</strong> ${safeReviewPeriod}</p>
              <p style="margin: 10px 0 0;"><strong>Reviewer:</strong> ${safeReviewerName}</p>
              <p style="margin: 10px 0 0;"><strong>Overall Rating:</strong> ${safeRatingText}</p>
              <p style="margin: 10px 0 0;"><strong>Status:</strong> ${safeStatusLabel}</p>
            </div>
            
             <p>
               <a href="${APP_URL}/performance" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Full Review</a>
             </p>
             <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
          </div>
        `
      );

      console.log("Email sent:", emailResult);
    } else {
      console.log(`Skipping email for ${employee.email} - review notifications disabled`);
    }

    return jsonResponse({ success: true, emailSent: wantsReviewNotifications });
  } catch (error) {
    console.error("Error in review-notification function:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
