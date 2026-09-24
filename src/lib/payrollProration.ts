import { format } from "date-fns";

/**
 * Pure payroll calculation helpers, kept free of Supabase/React so they can be
 * unit-tested. Mirrored in supabase/functions/generate-monthly-payroll/index.ts
 * (Deno can't import from src/) — keep the two in sync.
 */

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

export interface HolidayRow {
  event_date: string;
  end_date: string | null;
}

export interface SalaryComponents {
  basic_salary: number | string | null;
  hra?: number | string | null;
  transport_allowance?: number | string | null;
  medical_allowance?: number | string | null;
  other_allowances?: number | string | null;
  tax_deduction?: number | string | null;
  pf_deduction?: number | string | null;
}

export interface PayrollAmounts {
  basic_salary: number;
  total_allowances: number;
  total_deductions: number;
  net_salary: number;
}

/** Expands holiday rows (possibly multi-day) into a set of "yyyy-MM-dd" strings, clipped to [monthStart, monthEnd]. */
export function buildHolidaySet(holidays: HolidayRow[], monthStart: Date, monthEnd: Date): Set<string> {
  const set = new Set<string>();
  holidays.forEach((h) => {
    const hStart = new Date(`${h.event_date}T00:00:00`);
    const hEnd = h.end_date ? new Date(`${h.end_date}T00:00:00`) : hStart;
    const rangeStart = hStart < monthStart ? monthStart : hStart;
    const rangeEnd = hEnd > monthEnd ? monthEnd : hEnd;
    if (rangeStart > rangeEnd) return;
    for (const cur = new Date(rangeStart); cur <= rangeEnd; cur.setDate(cur.getDate() + 1)) {
      set.add(format(cur, "yyyy-MM-dd"));
    }
  });
  return set;
}

/** Counts days in [start, end] (inclusive) that fall on one of workingDays and aren't a holiday. */
export function countWorkingDays(start: Date, end: Date, workingDays: number[], holidaySet: Set<string>): number {
  let count = 0;
  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (workingDays.includes(cur.getDay()) && !holidaySet.has(format(cur, "yyyy-MM-dd"))) {
      count++;
    }
  }
  return count;
}

/** Falls back to Mon–Fri when an employee has no working days configured. */
export function resolveWorkingDays(workingDays: number[] | null | undefined): number[] {
  return workingDays && workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS;
}

/**
 * Fraction of the month's pay an employee earns: 1 unless they were hired after
 * the 1st, in which case it's working days from hire date / working days in month.
 * `hireDate` is a "yyyy-MM-dd" string.
 */
export function getProrationRatio(
  hireDate: string | null | undefined,
  monthStart: Date,
  monthEnd: Date,
  workingDays: number[],
  holidaySet: Set<string>
): number {
  const hire = hireDate ? new Date(`${hireDate}T00:00:00`) : null;
  if (!hire || hire <= monthStart) return 1;
  const totalWorkingDaysInMonth = countWorkingDays(monthStart, monthEnd, workingDays, holidaySet);
  const workedDays = countWorkingDays(hire, monthEnd, workingDays, holidaySet);
  return totalWorkingDaysInMonth > 0 ? workedDays / totalWorkingDaysInMonth : 1;
}

/** Applies the proration ratio to basic, allowances and deductions and derives net salary. */
export function calculatePayrollAmounts(salary: SalaryComponents, ratio: number): PayrollAmounts {
  const totalAllowances =
    Number(salary.hra || 0) +
    Number(salary.transport_allowance || 0) +
    Number(salary.medical_allowance || 0) +
    Number(salary.other_allowances || 0);

  const totalDeductions = Number(salary.tax_deduction || 0) + Number(salary.pf_deduction || 0);

  const basicSalary = Number(salary.basic_salary || 0) * ratio;
  const proratedAllowances = totalAllowances * ratio;
  const proratedDeductions = totalDeductions * ratio;

  return {
    basic_salary: basicSalary,
    total_allowances: proratedAllowances,
    total_deductions: proratedDeductions,
    net_salary: basicSalary + proratedAllowances - proratedDeductions,
  };
}
