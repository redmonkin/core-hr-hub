import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_id: string;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
  status: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
}

// Format time for display (e.g., "09:00:00" -> "9:00 AM")
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// This function is designed to be called by a cron job
// CRON_SECRET validation provides an additional security layer
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET to prevent unauthorized triggering
  const cronSecret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    console.error("Unauthorized: Invalid or missing cron secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized - invalid cron secret" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log("Checking for attendance reminders...");
    console.log("Today:", today);
    console.log("Current day of week:", currentDayOfWeek);
    console.log("Current time:", `${currentHour}:${currentMinute}`);

    // Fetch all active employees with their working schedule
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select(`
        id,
        first_name,
        last_name,
        email,
        user_id,
        working_hours_start,
        working_hours_end,
        working_days,
        status
      `)
      .eq("status", "active")
      .not("user_id", "is", null);

    if (employeesError) {
      console.error("Error fetching employees:", employeesError);
      throw employeesError;
    }

    console.log(`Found ${employees?.length || 0} active employees`);

    // Filter employees who work today
    const workingToday = (employees || []).filter((emp: Employee) => {
      const workingDays = emp.working_days || [1, 2, 3, 4, 5]; // Default: Mon-Fri
      return workingDays.includes(currentDayOfWeek);
    });

    console.log(`${workingToday.length} employees are scheduled to work today`);

    if (workingToday.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No employees scheduled for today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get today's attendance records
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from("attendance_records")
      .select("id, employee_id, date, clock_in, clock_out")
      .eq("date", today);

    if (attendanceError) {
      console.error("Error fetching attendance:", attendanceError);
      throw attendanceError;
    }

    const attendanceMap = new Map(
      (attendanceRecords || []).map((record: AttendanceRecord) => [record.employee_id, record])
    );

    // Get user IDs to fetch notification preferences
    const userIds = workingToday.map((emp: Employee) => emp.user_id).filter(Boolean);

    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, attendance_reminder_notifications")
      .in("user_id", userIds);

    const preferencesMap = new Map(
      (preferences || []).map((p: { user_id: string; attendance_reminder_notifications: boolean }) => 
        [p.user_id, p.attendance_reminder_notifications]
      )
    );

    const notifications: { user_id: string; title: string; message: string; type: string; link: string }[] = [];
    const emailPromises: Promise<any>[] = [];

    for (const emp of workingToday as Employee[]) {
      const attendance = attendanceMap.get(emp.id);
      const workStart = emp.working_hours_start || "09:00:00";
      const workEnd = emp.working_hours_end || "18:00:00";
      
      // Parse work hours
      const [startHour, startMinute] = workStart.split(':').map(Number);
      const [endHour, endMinute] = workEnd.split(':').map(Number);

      const wantsReminders = preferencesMap.get(emp.user_id) ?? true;

      // Clock-in reminder: Send 15 minutes before work start time
      const reminderHour = startHour;
      const reminderMinute = startMinute - 15 < 0 ? 60 + (startMinute - 15) : startMinute - 15;
      const adjustedReminderHour = startMinute - 15 < 0 ? startHour - 1 : startHour;

      const isClockInReminderTime = 
        currentHour === adjustedReminderHour && 
        Math.abs(currentMinute - reminderMinute) <= 10; // 10 minute window

      // Clock-out reminder: Send at work end time
      const isClockOutReminderTime = 
        currentHour === endHour && 
        Math.abs(currentMinute - endMinute) <= 10; // 10 minute window

      // Check for clock-in reminder
      if (isClockInReminderTime && !attendance?.clock_in) {
        const safeFirstName = escapeHtml(emp.first_name);
        const title = "Time to Clock In!";
        const message = `Your work day starts at ${formatTime(workStart)}. Don't forget to clock in!`;

        console.log(`Sending clock-in reminder to ${emp.email}`);

        // In-app notification
        notifications.push({
          user_id: emp.user_id,
          title,
          message,
          type: "info",
          link: "/attendance"
        });

        // Email notification
        if (wantsReminders) {
          emailPromises.push(
            sendEmail(
              [emp.email],
              title,
              `
                <h2>${title}</h2>
                <p>Hi ${safeFirstName},</p>
                <p>${message}</p>
                <p style="margin-top: 20px;">
                  <strong>Scheduled Start Time:</strong> ${formatTime(workStart)}
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
                <p style="margin-top: 20px;">Best regards,<br>HR Team</p>
              `
            ).catch((err: Error) => {
              console.error(`Failed to send email to ${emp.email}:`, err);
              return null;
            })
          );
        }
      }

      // Check for clock-out reminder
      if (isClockOutReminderTime && attendance?.clock_in && !attendance?.clock_out) {
        const safeFirstName = escapeHtml(emp.first_name);
        const title = "Time to Clock Out!";
        const message = `Your work day ends at ${formatTime(workEnd)}. Don't forget to clock out!`;

        console.log(`Sending clock-out reminder to ${emp.email}`);

        // In-app notification
        notifications.push({
          user_id: emp.user_id,
          title,
          message,
          type: "info",
          link: "/attendance"
        });

        // Email notification
        if (wantsReminders) {
          emailPromises.push(
            sendEmail(
              [emp.email],
              title,
              `
                <h2>${title}</h2>
                <p>Hi ${safeFirstName},</p>
                <p>${message}</p>
                <p style="margin-top: 20px;">
                  <strong>Scheduled End Time:</strong> ${formatTime(workEnd)}
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">You can manage your notification preferences in your profile settings.</p>
                <p style="margin-top: 20px;">Best regards,<br>HR Team</p>
              `
            ).catch((err: Error) => {
              console.error(`Failed to send email to ${emp.email}:`, err);
              return null;
            })
          );
        }
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);
      
      if (notifError) {
        console.error("Error inserting notifications:", notifError);
      } else {
        console.log(`Inserted ${notifications.length} notifications`);
      }
    }

    // Wait for all emails
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(r => r !== null).length;

    console.log(`Sent ${successfulEmails} emails successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        employeesChecked: workingToday.length,
        notificationsSent: notifications.length,
        emailsSent: successfulEmails
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in attendance-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
