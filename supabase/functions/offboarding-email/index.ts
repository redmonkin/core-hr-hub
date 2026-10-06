import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, getEmployeeIdForUser, userCan, usersWithModuleAccess } from "../_shared/auth.ts";
import {
  checklistEmail,
  decisionEmail,
  loadChecklistTemplate,
  loadDraft,
  loadExit,
  resignationReceivedEmail,
  resignationToHrEmail,
  resolveRecipients,
  sendEmail,
} from "../_shared/offboarding.ts";

/*
 * Offboarding emails sent from the app. Everything is loaded from the
 * database by id; the request only says which email and for which exit.
 *
 *   { action: "checklist", exit_id }              HR: email the department checklist
 *                                                 to the people chosen on the exit
 *   { action: "preview", draft: {...} }           HR: render that email before saving
 *   { action: "resignation", exit_id }            the employee who resigned: tell HR and
 *                                                 their reporting manager, confirm to them
 *   { action: "decision", exit_id }               HR: tell the employee their resignation
 *                                                 was approved (with the date) or declined
 */

const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checklist"), exit_id: z.string().uuid() }),
  z.object({
    action: z.literal("preview"),
    draft: z.object({
      employee_id: z.string().uuid(),
      reason: z.enum(["resignation", "termination", "end_of_contract", "retirement", "other"]),
      last_working_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      email_note: z.string().max(2000).nullable().optional(),
      notify_employee_ids: z.array(z.string().uuid()).max(100),
      notify_emails: z.array(z.string().email().max(254)).max(20),
    }),
  }),
  z.object({ action: z.literal("resignation"), exit_id: z.string().uuid() }),
  z.object({ action: z.literal("decision"), exit_id: z.string().uuid() }),
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase } = caller;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be JSON" }, 400);
    }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({
        error: "Invalid input",
        details: parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      }, 400);
    }
    const payload = parsed.data;
    const canManage = await userCan(supabase, userId, "onboarding", "manage");

    const { data: me } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    const callerEmail = (me?.email as string | undefined) ?? null;

    // ------------------------------------------------------------ preview
    if (payload.action === "preview") {
      if (!canManage) return jsonResponse({ error: "Forbidden" }, 403);
      const draft = await loadDraft(supabase, payload.draft);
      if (!draft) return jsonResponse({ error: "Employee not found" }, 404);
      const sections = await loadChecklistTemplate(supabase);
      const { subject, html } = checklistEmail(draft, sections, "start");
      const to = await resolveRecipients(supabase, draft);
      return jsonResponse({ subject, html, to, reply_to: callerEmail });
    }

    const exit = await loadExit(supabase, payload.exit_id);
    if (!exit) return jsonResponse({ error: "Offboarding not found" }, 404);

    // ------------------------------------------------------------ checklist
    if (payload.action === "checklist") {
      if (!canManage) return jsonResponse({ error: "Forbidden" }, 403);
      if (exit.status !== "in_progress") {
        return jsonResponse({ error: "Only an offboarding in progress can be emailed." }, 409);
      }
      const to = await resolveRecipients(supabase, exit);
      if (to.length === 0) return jsonResponse({ success: true, sent: 0 });
      const sections = await loadChecklistTemplate(supabase);
      const { subject, html } = checklistEmail(exit, sections, "start");
      try {
        await sendEmail({ to, cc: callerEmail ? [callerEmail] : [], replyTo: callerEmail, subject, html });
      } catch (err) {
        console.error("Error sending offboarding email:", err);
        return jsonResponse({ error: "The email couldn't be sent. Check the email settings and try again." }, 502);
      }
      await supabase
        .from("employee_exits")
        .update({ notified_at: new Date().toISOString(), checklist: { sections }, reminder_sent_at: null })
        .eq("id", exit.id);
      return jsonResponse({ success: true, sent: to.length });
    }

    // ------------------------------------------------------------ resignation
    if (payload.action === "resignation") {
      const myEmployeeId = await getEmployeeIdForUser(supabase, userId);
      if (myEmployeeId !== exit.employee_id && !canManage) return jsonResponse({ error: "Forbidden" }, 403);
      if (exit.status !== "requested") return jsonResponse({ error: "This resignation isn't pending." }, 409);

      const ids = await usersWithModuleAccess(supabase, "onboarding", "manage");
      const { data: hrProfiles } = ids.length
        ? await supabase.from("profiles").select("email").in("id", ids)
        : { data: [] };
      const to = new Set<string>(
        ((hrProfiles ?? []) as { email: string | null }[]).map((p) => p.email?.toLowerCase()).filter((e): e is string => !!e),
      );
      if (exit.manager?.email) to.add(exit.manager.email.toLowerCase());
      to.delete(exit.employee.email.toLowerCase());

      let sent = 0;
      try {
        if (to.size > 0) {
          const hr = resignationToHrEmail(exit, APP_URL);
          await sendEmail({ to: [...to], replyTo: exit.employee.email, subject: hr.subject, html: hr.html });
          sent += to.size;
        }
        const ack = resignationReceivedEmail(exit);
        await sendEmail({ to: [exit.employee.email], subject: ack.subject, html: ack.html });
        sent += 1;
      } catch (err) {
        console.error("Error sending resignation email:", err);
        return jsonResponse({ error: "The email couldn't be sent." }, 502);
      }
      return jsonResponse({ success: true, sent });
    }

    // ------------------------------------------------------------ decision
    if (!canManage) return jsonResponse({ error: "Forbidden" }, 403);
    if (exit.status !== "in_progress" && exit.status !== "declined") {
      return jsonResponse({ error: "There's no decision to send for this offboarding." }, 409);
    }
    const decision = decisionEmail(exit);
    try {
      await sendEmail({ to: [exit.employee.email], replyTo: callerEmail, subject: decision.subject, html: decision.html });
    } catch (err) {
      console.error("Error sending decision email:", err);
      return jsonResponse({ error: "The email couldn't be sent." }, 502);
    }
    return jsonResponse({ success: true, sent: 1 });
  } catch (error) {
    console.error("Error in offboarding-email:", error);
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
