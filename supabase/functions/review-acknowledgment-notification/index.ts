import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { authenticateCaller, getEmployeeIdForUser } from "../_shared/auth.ts";

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

// Only review_id is used; the employee name and review period come from the
// database (employee_name/review_period sent by older clients are ignored).
interface AcknowledgmentNotificationRequest {
  review_id: string;
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

    const payload: AcknowledgmentNotificationRequest = await req.json();
    const reviewId = payload?.review_id;
    console.log("Processing acknowledgment notification:", { review_id: reviewId });

    if (!reviewId || typeof reviewId !== "string") {
      return jsonResponse({ error: "Invalid input" }, 400);
    }

    // Get review with reviewer and employee details
    const { data: review, error: reviewError } = await supabase
      .from("performance_reviews")
      .select("reviewer_id, employee_id, review_period, status")
      .eq("id", reviewId)
      .maybeSingle();

    if (reviewError || !review) {
      console.error("Error fetching review:", reviewError);
      throw new Error("Review not found");
    }

    // Verify the caller is the employee being reviewed (acknowledging their own review)
    const callerEmployeeId = await getEmployeeIdForUser(supabase, userId);

    if (!callerEmployeeId || callerEmployeeId !== review.employee_id) {
      console.error("User not authorized - can only acknowledge own reviews");
      return jsonResponse({ error: 'Forbidden - You can only acknowledge your own reviews' }, 403);
    }

    if (review.status !== "acknowledged") {
      console.error("Review has not been acknowledged");
      return jsonResponse({ error: "Review has not been acknowledged" }, 409);
    }

    if (!review.reviewer_id) {
      console.log("No reviewer assigned, skipping notification");
      return jsonResponse({ success: true, message: "No reviewer to notify" });
    }

    // Get reviewer details
    const { data: reviewer, error: reviewerError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .eq("id", review.reviewer_id)
      .single();

    if (reviewerError || !reviewer) {
      console.error("Error fetching reviewer:", reviewerError);
      throw new Error("Reviewer not found");
    }

    console.log("Notifying reviewer:", reviewer.email);

    const { data: reviewedEmployee } = await supabase
      .from("employees")
      .select("first_name, last_name")
      .eq("id", review.employee_id)
      .maybeSingle();
    const employeeName = reviewedEmployee
      ? `${reviewedEmployee.first_name} ${reviewedEmployee.last_name}`
      : "An employee";
    const reviewPeriod = String(review.review_period ?? "");

    // Escape user-provided data for HTML
    const safeReviewerFirstName = escapeHtml(reviewer.first_name);
    const safeEmployeeName = escapeHtml(employeeName);
    const safeReviewPeriod = escapeHtml(reviewPeriod);

    // Create in-app notification for reviewer
    if (reviewer.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: reviewer.user_id,
          title: "Review Acknowledged",
          message: `${employeeName} has acknowledged their ${reviewPeriod} performance review.`,
          type: "success",
          link: "/reviews-management"
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("In-app notification created successfully");
      }
    }

    // Send email to reviewer
    const emailResult = await sendEmail(
      [reviewer.email],
      `Performance Review Acknowledged - ${safeEmployeeName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Performance Review Acknowledged</h2>
          <p>Hi ${safeReviewerFirstName},</p>
          <p>${safeEmployeeName} has acknowledged their ${safeReviewPeriod} performance review.</p>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32;"><strong>✓ Review Acknowledged</strong></p>
            <p style="margin: 10px 0 0;"><strong>Employee:</strong> ${safeEmployeeName}</p>
            <p style="margin: 10px 0 0;"><strong>Review Period:</strong> ${safeReviewPeriod}</p>
          </div>
          
           <p>
             <a href="${APP_URL}/reviews-management" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Review Details</a>
           </p>
           
           <p style="margin-top: 30px;">Best regards,<br>HR Team</p>
        </div>
      `
    );

    console.log("Acknowledgment email sent:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailResult }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in review-acknowledgment-notification function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
