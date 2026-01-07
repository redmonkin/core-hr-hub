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

interface AcknowledgmentNotificationRequest {
  review_id: string;
  employee_name: string;
  review_period: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: AcknowledgmentNotificationRequest = await req.json();

    console.log("Processing acknowledgment notification:", payload);

    // Get review with reviewer details
    const { data: review, error: reviewError } = await supabase
      .from("performance_reviews")
      .select("reviewer_id")
      .eq("id", payload.review_id)
      .single();

    if (reviewError || !review) {
      console.error("Error fetching review:", reviewError);
      throw new Error("Review not found");
    }

    if (!review.reviewer_id) {
      console.log("No reviewer assigned, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No reviewer to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Create in-app notification for reviewer
    if (reviewer.user_id) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: reviewer.user_id,
          title: "Review Acknowledged",
          message: `${payload.employee_name} has acknowledged their ${payload.review_period} performance review.`,
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
      `Performance Review Acknowledged - ${payload.employee_name}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Performance Review Acknowledged</h2>
          <p>Hi ${reviewer.first_name},</p>
          <p>${payload.employee_name} has acknowledged their ${payload.review_period} performance review.</p>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32;"><strong>✓ Review Acknowledged</strong></p>
            <p style="margin: 10px 0 0;"><strong>Employee:</strong> ${payload.employee_name}</p>
            <p style="margin: 10px 0 0;"><strong>Review Period:</strong> ${payload.review_period}</p>
          </div>
          
          <p>Log in to the HR portal to view the complete review details.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>HR System</p>
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
  } catch (error: any) {
    console.error("Error in review-acknowledgment-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
