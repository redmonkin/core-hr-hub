import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.87.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, createServiceClient, userCan } from "../_shared/auth.ts";
import { escapeHtml } from "../_shared/html.ts";
import { verifyCronSecret } from "../_shared/secrets.ts";

/*
 * Salary revision emails.
 *
 *   From the app (payroll:manage):  { action: "email", revision_id }
 *     Emails the employee about a revision that has just been applied.
 *
 *   Daily (pg_cron, x-cron-secret):
 *     Applies revisions whose effective date has come (apply_due_salary_revisions)
 *     and emails those employees.
 *
 * Only applied revisions with notify_employee are emailed, once (emailed_at).
 */

const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";

const TYPE_LABELS: Record<string, string> = {
  annual_appraisal: "annual appraisal",
  promotion: "promotion",
  market_correction: "market correction",
  adjustment: "salary adjustment",
  other: "salary revision",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

interface Components {
  basic_salary?: number | string | null;
  hra?: number | string | null;
  transport_allowance?: number | string | null;
  medical_allowance?: number | string | null;
  other_allowances?: number | string | null;
  tax_deduction?: number | string | null;
  pf_deduction?: number | string | null;
}
const gross = (c: Components) =>
  Number(c.basic_salary || 0) + Number(c.hra || 0) + Number(c.transport_allowance || 0) +
  Number(c.medical_allowance || 0) + Number(c.other_allowances || 0);
const net = (c: Components) => gross(c) - Number(c.tax_deduction || 0) - Number(c.pf_deduction || 0);

async function emailRevision(supabase: SupabaseClient, revisionId: string): Promise<"sent" | "skipped"> {
  const { data: r, error } = await supabase
    .from("salary_revisions")
    .select(`
      id, status, notify_employee, emailed_at, revision_type, effective_from, previous,
      basic_salary, hra, transport_allowance, medical_allowance, other_allowances, tax_deduction, pf_deduction,
      employee:employees!salary_revisions_employee_id_fkey(first_name, email)
    `)
    .eq("id", revisionId)
    .maybeSingle();
  if (error) throw error;
  const revision = r as unknown as (Components & {
    id: string;
    status: string;
    notify_employee: boolean;
    emailed_at: string | null;
    revision_type: string;
    effective_from: string;
    previous: Components | null;
    employee: { first_name: string; email: string } | null;
  }) | null;
  if (!revision || revision.status !== "applied" || !revision.notify_employee || revision.emailed_at || !revision.employee?.email) {
    return "skipped";
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email isn't configured (RESEND_API_KEY / RESEND_FROM_EMAIL)");

  const { data: branding } = await supabase
    .from("organization_settings")
    .select("setting_value")
    .eq("setting_key", "company_branding")
    .maybeSingle();
  const company = (branding?.setting_value as { company_name?: string } | null)?.company_name ?? "";

  const before = revision.previous ?? {};
  const oldGross = gross(before);
  const newGross = gross(revision);
  const change = oldGross > 0 ? ((newGross - oldGross) / oldGross) * 100 : null;
  const label = TYPE_LABELS[revision.revision_type] ?? "salary revision";

  const row = (k: string, v: string, bold = false) =>
    `<tr><td style="padding: 6px 18px 6px 0; color: #6b7280;">${escapeHtml(k)}</td><td style="padding: 6px 0;${bold ? " font-weight: bold;" : ""}">${escapeHtml(v)}</td></tr>`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.55; color: #1f2937; max-width: 600px;">
      <p>Hi ${escapeHtml(revision.employee.first_name)},</p>
      <p>Following your ${escapeHtml(label)}, your salary has been revised with effect from <strong>${escapeHtml(formatDate(revision.effective_from))}</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 18px;">
        ${row("Monthly gross (before)", inr(oldGross))}
        ${row("Monthly gross (revised)", inr(newGross), true)}
        ${change !== null ? row("Change", `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`) : ""}
        ${row("Monthly take-home (revised)", inr(net(revision)), true)}
        ${row("Annual gross (revised)", inr(newGross * 12))}
      </table>
      <p>Your salary revision letter, with the full breakdown, is in Peoplo under <strong>Profile → Payslips</strong>.</p>
      <p style="margin: 24px 0;"><a href="${escapeHtml(`${APP_URL}/profile?tab=payslips`)}" style="display: inline-block; padding: 11px 22px; background-color: #0369a1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">View revision letter</a></p>
      <p>Congratulations, and thank you for your work.</p>
      <p>HR Team${company ? `<br>${escapeHtml(company)}` : ""}</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [revision.employee.email],
      subject: "Your salary has been revised",
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded with ${res.status}: ${(await res.text()).slice(0, 200)}`);

  await supabase.from("salary_revisions").update({ emailed_at: new Date().toISOString() }).eq("id", revision.id);
  return "sent";
}

const requestSchema = z.object({ action: z.literal("email"), revision_id: z.string().uuid() });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ------------------------------------------------------------ daily job
    if (req.headers.get("x-cron-secret") !== null) {
      if (!(await verifyCronSecret(req))) {
        return jsonResponse({ error: "Unauthorized - invalid cron secret" }, 401);
      }
      const supabase = createServiceClient();
      const { error: applyError } = await supabase.rpc("apply_due_salary_revisions");
      if (applyError) throw applyError;

      const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: toEmail, error } = await supabase
        .from("salary_revisions")
        .select("id")
        .eq("status", "applied")
        .eq("notify_employee", true)
        .is("emailed_at", null)
        .gte("applied_at", since);
      if (error) throw error;

      let emailed = 0;
      for (const { id } of (toEmail ?? []) as { id: string }[]) {
        try {
          if ((await emailRevision(supabase, id)) === "sent") emailed++;
        } catch (err) {
          console.error(`Error emailing salary revision ${id}:`, err);
        }
      }
      return jsonResponse({ success: true, emailed });
    }

    // ------------------------------------------------------------ from the app
    const caller = await authenticateCaller(req);
    if (!caller.ok) return caller.response;
    const { userId, supabase } = caller;
    if (!(await userCan(supabase, userId, "payroll", "manage"))) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be JSON" }, 400);
    }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ error: "Invalid input" }, 400);

    try {
      const result = await emailRevision(supabase, parsed.data.revision_id);
      return jsonResponse({ success: true, result });
    } catch (err) {
      console.error("Error emailing salary revision:", err);
      return jsonResponse({ error: "The email couldn't be sent." }, 502);
    }
  } catch (error) {
    console.error("Error in salary-revisions:", error);
    return jsonResponse({ error: "An unexpected error occurred" }, 500);
  }
});
