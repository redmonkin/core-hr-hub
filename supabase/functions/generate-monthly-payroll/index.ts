import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";
import { corsHeaders } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/html.ts";
import { verifyCronSecret } from "../_shared/secrets.ts";
import { usersWithModuleAccess } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://peoplo.redmonk.in";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SalaryStructureRow {
  employee_id: string;
  basic_salary: number;
  hra: number | null;
  transport_allowance: number | null;
  medical_allowance: number | null;
  other_allowances: number | null;
  tax_deduction: number | null;
  pf_deduction: number | null;
  employee: {
    hire_date: string | null;
    working_days: number[] | null;
    exit_date: string | null;
  } | null;
}

/** Expands holiday rows (possibly multi-day) into a set of "yyyy-MM-dd" strings, clipped to [monthStart, monthEnd]. */
function buildHolidaySet(
  holidays: { event_date: string; end_date: string | null }[],
  monthStart: Date,
  monthEnd: Date
): Set<string> {
  const set = new Set<string>();
  holidays.forEach((h) => {
    const hStart = new Date(`${h.event_date}T00:00:00`);
    const hEnd = h.end_date ? new Date(`${h.end_date}T00:00:00`) : hStart;
    const rangeStart = hStart < monthStart ? monthStart : hStart;
    const rangeEnd = hEnd > monthEnd ? monthEnd : hEnd;
    if (rangeStart > rangeEnd) return;
    for (const cur = new Date(rangeStart); cur <= rangeEnd; cur.setDate(cur.getDate() + 1)) {
      set.add(cur.toISOString().split("T")[0]);
    }
  });
  return set;
}

/** Counts days in [start, end] (inclusive) that fall on one of workingDays and aren't a holiday. */
function countWorkingDays(start: Date, end: Date, workingDays: number[], holidaySet: Set<string>): number {
  let count = 0;
  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (workingDays.includes(cur.getDay()) && !holidaySet.has(cur.toISOString().split("T")[0])) {
      count++;
    }
  }
  return count;
}

// This function is designed to be called by a cron job on the last day of
// every month (pg_cron schedule '0 9 $ * *'). CRON_SECRET validation provides an additional security layer.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET (constant-time) to prevent unauthorized triggering
  if (!(await verifyCronSecret(req))) {
    console.error("Unauthorized: Invalid or missing cron secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized - invalid cron secret" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthName = MONTH_NAMES[month - 1];

    console.log(`Generating payroll for ${monthName} ${year}...`);

    const { data: existingRecords } = await supabase
      .from("payroll_records")
      .select("id")
      .eq("month", month)
      .eq("year", year);

    if (existingRecords && existingRecords.length > 0) {
      console.log("Payroll already exists for this month, skipping.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Payroll already exists for this month" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const monthEndStr = monthEnd.toISOString().split("T")[0];

    const { data: salaryStructures, error: salaryError } = await supabase
      .from("salary_structures")
      .select(`
        employee_id,
        basic_salary,
        hra,
        transport_allowance,
        medical_allowance,
        other_allowances,
        tax_deduction,
        pf_deduction,
        employee:employees(hire_date, working_days, exit_date)
      `);

    if (salaryError) throw salaryError;

    if (!salaryStructures || salaryStructures.length === 0) {
      console.log("No salary structures found, nothing to generate.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "No salary structures found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only people employed during the month: joined by its end, and not gone
    // before its start (exit_date is the last working day, set as soon as an
    // offboarding is under way)
    const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const eligible = (salaryStructures as unknown as SalaryStructureRow[]).filter((s) => {
      const hireDate = s.employee?.hire_date;
      const exitDate = s.employee?.exit_date;
      return (!hireDate || hireDate <= monthEndStr) && (!exitDate || exitDate >= monthStartStr);
    });

    if (eligible.length === 0) {
      console.log("No employees were active during this month.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "No employees were active during this month" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: holidays } = await supabase
      .from("company_events")
      .select("event_date, end_date")
      .eq("is_holiday", true)
      .lte("event_date", monthEndStr);

    const holidaySet = buildHolidaySet(holidays || [], monthStart, monthEnd);

    const payrollRecords = eligible.map((salary) => {
      const totalAllowances =
        Number(salary.hra || 0) +
        Number(salary.transport_allowance || 0) +
        Number(salary.medical_allowance || 0) +
        Number(salary.other_allowances || 0);

      const totalDeductions =
        Number(salary.tax_deduction || 0) +
        Number(salary.pf_deduction || 0);

      const workingDays =
        salary.employee?.working_days && salary.employee.working_days.length > 0
          ? salary.employee.working_days
          : [1, 2, 3, 4, 5];

      // Prorate by working days employed this month: from the hire date if they
      // joined after the 1st, up to the last working day if they're leaving
      const hireDate = salary.employee?.hire_date ? new Date(`${salary.employee.hire_date}T00:00:00`) : null;
      const exitDate = salary.employee?.exit_date ? new Date(`${salary.employee.exit_date}T00:00:00`) : null;
      const from = hireDate && hireDate > monthStart ? hireDate : monthStart;
      const to = exitDate && exitDate < monthEnd ? exitDate : monthEnd;

      let ratio = 1;
      if (from > monthStart || to < monthEnd) {
        const totalWorkingDaysInMonth = countWorkingDays(monthStart, monthEnd, workingDays, holidaySet);
        const workedDays = to < from ? 0 : countWorkingDays(from, to, workingDays, holidaySet);
        ratio = totalWorkingDaysInMonth > 0 ? workedDays / totalWorkingDaysInMonth : 1;
      }

      // Components as generated, so a later salary revision never changes this payslip
      const part = (v: number | null) => Math.round(Number(v || 0) * ratio * 100) / 100;
      const components = {
        hra: part(salary.hra),
        transport_allowance: part(salary.transport_allowance),
        medical_allowance: part(salary.medical_allowance),
        other_allowances: part(salary.other_allowances),
        tax_deduction: part(salary.tax_deduction),
        pf_deduction: part(salary.pf_deduction),
      };

      const basicSalary = Number(salary.basic_salary) * ratio;
      const proratedAllowances = totalAllowances * ratio;
      const proratedDeductions = totalDeductions * ratio;
      const netSalary = basicSalary + proratedAllowances - proratedDeductions;

      return {
        employee_id: salary.employee_id,
        month,
        year,
        basic_salary: basicSalary,
        total_allowances: proratedAllowances,
        total_deductions: proratedDeductions,
        net_salary: netSalary,
        ...components,
        status: "draft" as const,
      };
    });

    const { error: insertError } = await supabase
      .from("payroll_records")
      .insert(payrollRecords);

    if (insertError) throw insertError;

    console.log(`Generated ${payrollRecords.length} payroll records for ${monthName} ${year}`);

    // Notify everyone who can manage payroll that it's ready to process
    const adminUserIds = await usersWithModuleAccess(supabase, "payroll", "manage");

    let emailsSent = 0;
    if (adminUserIds.length > 0) {
      const { data: admins } = await supabase
        .from("employees")
        .select("user_id, first_name, email")
        .in("user_id", adminUserIds);

      const title = `Payslips for ${monthName} ${year} are ready to process`;
      const message = `Payroll for ${payrollRecords.length} employee${payrollRecords.length === 1 ? "" : "s"} has been generated for ${monthName} ${year} and is waiting for review.`;

      const notifications = (admins || []).map((admin: { user_id: string }) => ({
        user_id: admin.user_id,
        title,
        message,
        type: "info",
        link: "/payroll",
      }));

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        if (notifError) console.error("Error inserting admin notifications:", notifError);

        try {
          for (const notif of notifications) {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                user_ids: [notif.user_id],
                title: notif.title,
                body: notif.message,
                url: "/payroll",
              }),
            });
          }
        } catch (pushErr) {
          console.error("Push notification error:", pushErr);
        }
      }

      const emailResults = await Promise.all(
        (admins || [])
          .filter((admin: { email: string | null }) => !!admin.email)
          .map((admin: { first_name: string; email: string }) => {
            const safeFirstName = escapeHtml(admin.first_name);
            return sendEmail(
              [admin.email],
              title,
              `
                <h2>${title}</h2>
                <p>Hi ${safeFirstName},</p>
                <p>${message}</p>
                <p>
                  <a href="${APP_URL}/payroll" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Payroll</a>
                </p>
                <p style="margin-top: 20px;">Best regards,<br>HR Team</p>
              `
            ).catch((err: Error) => {
              console.error(`Failed to send email to ${admin.email}:`, err);
              return null;
            });
          })
      );
      emailsSent = emailResults.filter((r) => r !== null).length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        recordsGenerated: payrollRecords.length,
        adminsNotified: adminUserIds.length,
        emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-monthly-payroll function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
