import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { verifyCronSecret } from "../_shared/secrets.ts";
import { createServiceClient } from "../_shared/auth.ts";
import {
  checklistEmail,
  loadChecklistTemplate,
  loadExit,
  resolveRecipients,
  sendEmail,
  todayIso,
} from "../_shared/offboarding.ts";

/*
 * Daily (pg_cron, 09:00 IST): on someone's last working day, remind the
 * people their offboarding checklist was emailed to. Sent once per exit.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!(await verifyCronSecret(req))) {
    return jsonResponse({ error: "Unauthorized - invalid cron secret" }, 401);
  }

  try {
    const supabase = createServiceClient();
    const { data: due, error } = await supabase
      .from("employee_exits")
      .select("id")
      .eq("status", "in_progress")
      .eq("last_working_day", todayIso())
      .not("notified_at", "is", null)
      .is("reminder_sent_at", null);
    if (error) throw error;

    let reminded = 0;
    for (const { id } of (due ?? []) as { id: string }[]) {
      const exit = await loadExit(supabase, id);
      if (!exit) continue;
      const to = await resolveRecipients(supabase, exit);
      if (to.length === 0) continue;
      const sections = exit.checklist?.sections ?? (await loadChecklistTemplate(supabase));
      const { subject, html } = checklistEmail(exit, sections, "reminder");
      try {
        await sendEmail({ to, subject, html });
        await supabase.from("employee_exits").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id);
        reminded++;
      } catch (err) {
        console.error(`Error sending offboarding reminder for ${id}:`, err);
      }
    }
    return jsonResponse({ success: true, reminded });
  } catch (error) {
    console.error("Error in offboarding-reminders:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
