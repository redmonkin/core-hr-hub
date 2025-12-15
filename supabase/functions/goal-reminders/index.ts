import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_id: string;
}

interface GoalRow {
  id: string;
  title: string;
  due_date: string;
  progress: number;
  employee_id: string;
  last_reminder_sent: string | null;
  employees: Employee;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    console.log("Checking for goals with upcoming deadlines...");
    console.log("Today:", today.toISOString().split('T')[0]);
    console.log("7 days from now:", sevenDaysFromNow.toISOString().split('T')[0]);
    console.log("3 days from now:", threeDaysFromNow.toISOString().split('T')[0]);

    // Fetch goals with deadlines within 7 days that are not completed
    const { data: goals, error: goalsError } = await supabase
      .from("goals")
      .select(`
        id,
        title,
        due_date,
        progress,
        employee_id,
        last_reminder_sent,
        employees!inner (
          id,
          first_name,
          last_name,
          email,
          user_id
        )
      `)
      .neq("status", "completed")
      .gte("due_date", today.toISOString().split('T')[0])
      .lte("due_date", sevenDaysFromNow.toISOString().split('T')[0]);

    if (goalsError) {
      console.error("Error fetching goals:", goalsError);
      throw goalsError;
    }

    console.log(`Found ${goals?.length || 0} goals with upcoming deadlines`);

    const notifications: { user_id: string; title: string; message: string; type: string; link: string }[] = [];
    const emailPromises: Promise<any>[] = [];
    const goalUpdates: { id: string; last_reminder_sent: string }[] = [];

    for (const goalData of goals || []) {
      const goal = goalData as unknown as GoalRow;
      const dueDate = new Date(goal.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine if we should send a reminder
      let shouldRemind = false;
      let reminderType = "";

      if (daysUntilDue <= 3) {
        // 3-day reminder
        const lastReminder = goal.last_reminder_sent ? new Date(goal.last_reminder_sent) : null;
        const daysSinceLastReminder = lastReminder 
          ? Math.ceil((today.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;
        
        // Only send if we haven't sent a reminder today
        if (daysSinceLastReminder >= 1) {
          shouldRemind = true;
          reminderType = "urgent";
        }
      } else if (daysUntilDue <= 7) {
        // 7-day reminder - only if no reminder sent in last 4 days
        const lastReminder = goal.last_reminder_sent ? new Date(goal.last_reminder_sent) : null;
        const daysSinceLastReminder = lastReminder 
          ? Math.ceil((today.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;
        
        if (daysSinceLastReminder >= 4) {
          shouldRemind = true;
          reminderType = "upcoming";
        }
      }

      if (shouldRemind && goal.employees?.user_id) {
        const employee = goal.employees;
        const title = reminderType === "urgent" 
          ? `Urgent: Goal deadline in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`
          : `Goal deadline approaching in ${daysUntilDue} days`;
        
        const message = `Your goal "${goal.title}" is due on ${new Date(goal.due_date).toLocaleDateString()}. Current progress: ${goal.progress}%`;

        console.log(`Sending ${reminderType} reminder to ${employee.email} for goal: ${goal.title}`);

        // Add in-app notification
        notifications.push({
          user_id: employee.user_id,
          title,
          message,
          type: reminderType === "urgent" ? "warning" : "info",
          link: "/performance"
        });

        // Send email
        emailPromises.push(
          resend.emails.send({
            from: "HR System <onboarding@resend.dev>",
            to: [employee.email],
            subject: title,
            html: `
              <h2>${title}</h2>
              <p>Hi ${employee.first_name},</p>
              <p>${message}</p>
              <p>Please update your progress or complete this goal before the deadline.</p>
              <p style="margin-top: 20px;">
                <strong>Goal:</strong> ${goal.title}<br>
                <strong>Due Date:</strong> ${new Date(goal.due_date).toLocaleDateString()}<br>
                <strong>Current Progress:</strong> ${goal.progress}%
              </p>
              <p style="margin-top: 20px;">Best regards,<br>HR Team</p>
            `,
          }).catch(err => {
            console.error(`Failed to send email to ${employee.email}:`, err);
            return null;
          })
        );

        goalUpdates.push({
          id: goal.id,
          last_reminder_sent: today.toISOString()
        });
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

    // Update last_reminder_sent for goals
    for (const update of goalUpdates) {
      await supabase
        .from("goals")
        .update({ last_reminder_sent: update.last_reminder_sent })
        .eq("id", update.id);
    }

    // Wait for all emails
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(r => r !== null).length;

    console.log(`Sent ${successfulEmails} emails successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        goalsProcessed: goals?.length || 0,
        notificationsSent: notifications.length,
        emailsSent: successfulEmails
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in goal-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
