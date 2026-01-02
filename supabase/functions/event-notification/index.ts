import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  is_holiday: boolean;
}

interface Employee {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_id: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get upcoming events in the next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split("T")[0];
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    console.log(`Fetching events between ${todayStr} and ${nextWeekStr}`);

    const { data: events, error: eventsError } = await supabase
      .from("company_events")
      .select("*")
      .gte("event_date", todayStr)
      .lte("event_date", nextWeekStr)
      .order("event_date", { ascending: true });

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }

    if (!events || events.length === 0) {
      console.log("No upcoming events found");
      return new Response(
        JSON.stringify({ message: "No upcoming events to notify about" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Separate events and holidays
    const holidays = events.filter((e: CompanyEvent) => e.is_holiday);
    const regularEvents = events.filter((e: CompanyEvent) => !e.is_holiday);

    console.log(`Found ${events.length} upcoming events (${holidays.length} holidays, ${regularEvents.length} events)`);

    // Get all active employees with email and user_id
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, email, first_name, last_name, user_id")
      .eq("status", "active");

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    if (!employees || employees.length === 0) {
      console.log("No active employees found");
      return new Response(
        JSON.stringify({ message: "No active employees to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get notification preferences for all users
    const userIds = employees.filter((e: Employee) => e.user_id).map((e: Employee) => e.user_id);
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id, event_notifications, holiday_notifications")
      .in("user_id", userIds);

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
    }

    const preferencesMap = new Map(
      (preferences || []).map((p: { user_id: string; event_notifications: boolean; holiday_notifications: boolean }) => [p.user_id, p])
    );

    console.log(`Found preferences for ${preferencesMap.size} users`);

    // Build event list HTML generator
    const buildEventListHtml = (eventList: CompanyEvent[]) => {
      return eventList
        .map((event: CompanyEvent) => {
          const eventDate = new Date(event.event_date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const typeLabel = event.is_holiday ? "🎉 Holiday" : "📅 Event";
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>${event.title}</strong>
                <br>
                <span style="color: #666; font-size: 14px;">${eventDate}</span>
                <br>
                <span style="background: ${event.is_holiday ? "#fee2e2" : "#dbeafe"}; color: ${event.is_holiday ? "#dc2626" : "#2563eb"}; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${typeLabel}</span>
                ${event.description ? `<br><span style="color: #888; font-size: 13px; margin-top: 4px; display: inline-block;">${event.description}</span>` : ""}
              </td>
            </tr>
          `;
        })
        .join("");
    };

    // Send email to each employee based on preferences
    const emailPromises = employees.map(async (employee: Employee) => {
      try {
        // Check notification preferences
        const userPrefs = employee.user_id ? preferencesMap.get(employee.user_id) : null;
        
        // Default to true if no preferences found
        const wantsEventNotifications = userPrefs?.event_notifications ?? true;
        const wantsHolidayNotifications = userPrefs?.holiday_notifications ?? true;

        // Filter events based on preferences
        const eventsToNotify: CompanyEvent[] = [];
        if (wantsEventNotifications) {
          eventsToNotify.push(...regularEvents);
        }
        if (wantsHolidayNotifications) {
          eventsToNotify.push(...holidays);
        }

        if (eventsToNotify.length === 0) {
          console.log(`Skipping ${employee.email} - no events match their preferences`);
          return { email: employee.email, success: true, skipped: true };
        }

        // Sort events by date
        eventsToNotify.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

        const eventListHtml = buildEventListHtml(eventsToNotify);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Peoplo <onboarding@resend.dev>",
            to: [employee.email],
            subject: `📅 Upcoming Events & Holidays This Week`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">📅 Upcoming Events</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Hello ${employee.first_name},</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
                  <p style="color: #666; margin-bottom: 20px;">Here are the upcoming events and holidays for the next 7 days:</p>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    ${eventListHtml}
                  </table>
                  
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      This is an automated notification from Peoplo.<br>
                      You can manage your notification preferences in your profile settings.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        const result = await emailResponse.json();
        console.log(`Email sent to ${employee.email}:`, result);
        return { email: employee.email, success: emailResponse.ok };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed to send email to ${employee.email}:`, error);
        return { email: employee.email, success: false, error: errorMessage };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Notification complete. Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} notifications, ${skippedCount} skipped (preferences), ${failCount} failed`,
        eventsCount: events.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in event-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
