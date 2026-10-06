import type { SupabaseClient } from "npm:@supabase/supabase-js@2.87.1";
import { escapeHtml } from "./html.ts";

/*
 * Shared pieces for the offboarding emails: loading an exit with everything
 * the email shows, the department-wise checklist template, recipients, and
 * the HTML. Used by offboarding-email (sent from the app) and
 * offboarding-reminders (last-working-day reminder, pg_cron).
 */

export interface ChecklistSection {
  name: string;
  items: string[];
}

export interface ExitForEmail {
  id: string;
  employee_id: string;
  reason: string;
  status: string;
  notice_date: string;
  last_working_day: string;
  notes: string | null;
  decision_notes: string | null;
  email_note: string | null;
  notify_employee_ids: string[];
  notify_emails: string[];
  checklist: { sections: ChecklistSection[] } | null;
  employee: {
    first_name: string;
    last_name: string;
    email: string;
    employee_code: string | null;
    designation: string | null;
    manager_id: string | null;
    department: { name: string } | null;
  };
  manager: { first_name: string; last_name: string; email: string } | null;
}

const EXIT_SELECT = `
  id, employee_id, reason, status, notice_date, last_working_day, notes, decision_notes,
  email_note, notify_employee_ids, notify_emails, checklist,
  employee:employees!employee_exits_employee_id_fkey(
    first_name, last_name, email, employee_code, designation, manager_id,
    department:departments!employees_department_id_fkey(name)
  )
`;

export async function loadExit(supabase: SupabaseClient, exitId: string): Promise<ExitForEmail | null> {
  const { data, error } = await supabase.from("employee_exits").select(EXIT_SELECT).eq("id", exitId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const exit = data as unknown as Omit<ExitForEmail, "manager">;
  return { ...exit, manager: await loadManager(supabase, exit.employee.manager_id) };
}

/** Builds the same shape as loadExit for a preview, before the exit is saved. */
export async function loadDraft(
  supabase: SupabaseClient,
  draft: {
    employee_id: string;
    reason: string;
    last_working_day: string;
    email_note?: string | null;
    notify_employee_ids: string[];
    notify_emails: string[];
  },
): Promise<ExitForEmail | null> {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "first_name, last_name, email, employee_code, designation, manager_id, department:departments!employees_department_id_fkey(name)",
    )
    .eq("id", draft.employee_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const employee = data as unknown as ExitForEmail["employee"];
  return {
    id: "preview",
    employee_id: draft.employee_id,
    reason: draft.reason,
    status: "in_progress",
    notice_date: draft.last_working_day,
    last_working_day: draft.last_working_day,
    notes: null,
    decision_notes: null,
    email_note: draft.email_note ?? null,
    notify_employee_ids: draft.notify_employee_ids,
    notify_emails: draft.notify_emails,
    checklist: null,
    employee,
    manager: await loadManager(supabase, employee.manager_id),
  };
}

async function loadManager(supabase: SupabaseClient, managerId: string | null) {
  if (!managerId) return null;
  const { data } = await supabase
    .from("employees")
    .select("first_name, last_name, email")
    .eq("id", managerId)
    .maybeSingle();
  return (data as ExitForEmail["manager"]) ?? null;
}

/** The current department-wise checklist template, cleaned up. */
export async function loadChecklistTemplate(supabase: SupabaseClient): Promise<ChecklistSection[]> {
  const { data } = await supabase
    .from("organization_settings")
    .select("setting_value")
    .eq("setting_key", "offboarding_checklist")
    .maybeSingle();
  const sections = (data?.setting_value as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections
    .map((s) => {
      const section = s as { name?: unknown; items?: unknown };
      return {
        name: typeof section.name === "string" ? section.name.trim() : "",
        items: Array.isArray(section.items)
          ? section.items.filter((i): i is string => typeof i === "string" && i.trim() !== "").map((i) => i.trim())
          : [],
      };
    })
    .filter((s) => s.name !== "" && s.items.length > 0);
}

/** Email addresses for the people HR picked plus any outside addresses (never the leaver). */
export async function resolveRecipients(supabase: SupabaseClient, exit: ExitForEmail): Promise<string[]> {
  const emails = new Set<string>();
  if (exit.notify_employee_ids.length > 0) {
    const { data } = await supabase
      .from("employees")
      .select("id, email, status")
      .in("id", exit.notify_employee_ids);
    for (const e of (data ?? []) as { id: string; email: string; status: string }[]) {
      if (e.id !== exit.employee_id && e.status !== "offboarded" && e.email) emails.add(e.email.trim().toLowerCase());
    }
  }
  for (const e of exit.notify_emails) emails.add(e.trim().toLowerCase());
  emails.delete(exit.employee.email.trim().toLowerCase());
  return [...emails];
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10-09" -> "9 Oct 2026" (or "9th October 2026" with long = true). */
export function formatDate(date: string, long = false): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!long) return `${d} ${MONTHS[m - 1]} ${y}`;
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${String(d).padStart(2, "0")}${suffix} ${LONG_MONTHS[m - 1]} ${y}`;
}

export const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim();

/** Today in UTC as yyyy-MM-dd (the reminder job runs at 09:00 IST, which is the same date). */
export const todayIso = () => new Date().toISOString().slice(0, 10);

function leavingSentence(exit: ExitForEmail): string {
  const name = fullName(exit.employee);
  const past = exit.last_working_day < todayIso();
  const lwd = formatDate(exit.last_working_day, true);
  const day = `their last working day ${past ? "was" : "is"} ${lwd}`;
  switch (exit.reason) {
    case "resignation":
      return `${name} has resigned from their role, and ${day}.`;
    case "end_of_contract":
      return `${name}'s contract is ending, and ${day}.`;
    case "retirement":
      return `${name} is retiring, and ${day}.`;
    default:
      return `${name} is leaving the company, and ${day}.`;
  }
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const wrap = (inner: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.55; color: #1f2937; max-width: 680px;">
    ${inner}
  </div>`;

const button = (href: string, label: string) =>
  `<p style="margin: 24px 0;"><a href="${escapeHtml(href)}" style="display: inline-block; padding: 11px 22px; background-color: #0369a1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">${escapeHtml(label)}</a></p>`;

function detailsTable(exit: ExitForEmail): string {
  const rows: [string, string][] = [
    ["Name", fullName(exit.employee)],
    ["Employee ID", exit.employee.employee_code ?? "-"],
    ["Department", exit.employee.department?.name ?? "-"],
    ["Designation", exit.employee.designation ?? "-"],
    ["Last Working Day", formatDate(exit.last_working_day, true)],
    ["Reporting Manager", exit.manager ? fullName(exit.manager) : "-"],
  ];
  return `
    <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 8px 0 20px;">
      ${rows
        .map(
          ([k, v]) => `
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;">${escapeHtml(k)}</td>
          <td style="padding: 6px 0; font-weight: bold;">${escapeHtml(v)}</td>
        </tr>`,
        )
        .join("")}
    </table>`;
}

function checklistHtml(sections: ChecklistSection[]): string {
  if (sections.length === 0) return "";
  return `
    <p style="margin: 20px 0 8px;">Please find below a checklist of access/items to be revoked or collected by the respective teams:</p>
    ${sections
      .map(
        (s) => `
      <h3 style="margin: 18px 0 6px; font-size: 15px; color: #0369a1;">${escapeHtml(s.name)}</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${s.items.map((i) => `<li style="margin: 3px 0;">${escapeHtml(i)}</li>`).join("")}
      </ul>`,
      )
      .join("")}`;
}

const noteHtml = (note: string | null) =>
  note && note.trim()
    ? `<p style="margin: 16px 0; padding: 10px 14px; background: #f0f9ff; border-left: 3px solid #0369a1;"><strong>Note:</strong> ${escapeHtml(note.trim()).replace(/\n/g, "<br>")}</p>`
    : "";

export function checklistEmail(exit: ExitForEmail, sections: ChecklistSection[], kind: "start" | "reminder") {
  const name = fullName(exit.employee);
  const lwdShort = formatDate(exit.last_working_day);
  const subject =
    kind === "reminder"
      ? `Reminder: today is ${name}'s last working day`
      : `Offboarding: ${name} – last working day ${lwdShort}`;
  const intro =
    kind === "reminder"
      ? `<p>This is a reminder that today is <strong>${escapeHtml(name)}</strong>'s last working day. If you haven't yet, please complete the offboarding actions below for your department and confirm by replying to the original email.</p>`
      : `<p>This is to inform you that ${escapeHtml(leavingSentence(exit))}</p>
         <p>Please initiate the standard offboarding process, including revoking all system, physical and financial access as applicable to your department. Kindly complete the relevant actions and confirm completion by replying to this email.</p>`;
  const html = wrap(`
    <p>Hello All,</p>
    ${intro}
    ${noteHtml(exit.email_note)}
    <p style="margin: 16px 0 4px; font-weight: bold;">Employee details</p>
    ${detailsTable(exit)}
    ${checklistHtml(sections)}
    <p style="margin-top: 22px;">Please treat this as time-sensitive and confirm completion of the above actions by replying to this email with the checklist marked accordingly.</p>
    <p>Thank you,<br>HR Team</p>
  `);
  return { subject, html };
}

export function resignationToHrEmail(exit: ExitForEmail, appUrl: string) {
  const name = fullName(exit.employee);
  const subject = `Resignation: ${name} – proposed last working day ${formatDate(exit.last_working_day)}`;
  const html = wrap(`
    <p>Hello,</p>
    <p><strong>${escapeHtml(name)}</strong> has submitted their resignation in Peoplo. Their proposed last working day is <strong>${escapeHtml(formatDate(exit.last_working_day, true))}</strong>.</p>
    ${exit.notes ? `<p style="margin: 16px 0; padding: 10px 14px; background: #f9fafb; border-left: 3px solid #9ca3af;"><strong>Their message:</strong> ${escapeHtml(exit.notes).replace(/\n/g, "<br>")}</p>` : ""}
    ${detailsTable(exit)}
    <p>HR can approve it (and confirm the last working day) or decline it in Peoplo.</p>
    ${button(`${appUrl}/onboarding?tab=leaving`, "Review resignation")}
  `);
  return { subject, html };
}

export function resignationReceivedEmail(exit: ExitForEmail) {
  const subject = "We've received your resignation";
  const html = wrap(`
    <p>Hi ${escapeHtml(exit.employee.first_name)},</p>
    <p>We've received your resignation with a proposed last working day of <strong>${escapeHtml(formatDate(exit.last_working_day, true))}</strong>.</p>
    <p>HR will review it and confirm your last working day. You can withdraw it from your profile in Peoplo until it's approved.</p>
    <p>Thank you,<br>HR Team</p>
  `);
  return { subject, html };
}

export function decisionEmail(exit: ExitForEmail) {
  if (exit.status === "declined") {
    return {
      subject: "About your resignation",
      html: wrap(`
        <p>Hi ${escapeHtml(exit.employee.first_name)},</p>
        <p>HR hasn't accepted your resignation.</p>
        ${exit.decision_notes ? `<p style="margin: 16px 0; padding: 10px 14px; background: #f9fafb; border-left: 3px solid #9ca3af;">${escapeHtml(exit.decision_notes).replace(/\n/g, "<br>")}</p>` : ""}
        <p>Please talk to HR if you have any questions.</p>
        <p>Thank you,<br>HR Team</p>
      `),
    };
  }
  return {
    subject: `Your last working day: ${formatDate(exit.last_working_day)}`,
    html: wrap(`
      <p>Hi ${escapeHtml(exit.employee.first_name)},</p>
      <p>Your resignation has been accepted. Your last working day is <strong>${escapeHtml(formatDate(exit.last_working_day, true))}</strong>.</p>
      <p>Please complete your handover and return company assets by then. You can use Peoplo until the end of that day, so download any payslips or documents you need before then.</p>
      <p>Thank you,<br>HR Team</p>
    `),
  };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function sendEmail(opts: {
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email isn't configured (RESEND_API_KEY / RESEND_FROM_EMAIL)");
  const cc = (opts.cc ?? []).filter((c) => !opts.to.includes(c));
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: opts.to,
      ...(cc.length ? { cc } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded with ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
