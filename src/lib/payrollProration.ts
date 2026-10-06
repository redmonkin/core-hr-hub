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
 * Fraction of the month's pay an employee earns: working days they were
 * employed / working days in the month. That's 1 unless they joined after the
 * 1st or their last working day (`exitDate`) falls before the month's end.
 * Dates are "yyyy-MM-dd" strings.
 */
export function getProrationRatio(
  hireDate: string | null | undefined,
  monthStart: Date,
  monthEnd: Date,
  workingDays: number[],
  holidaySet: Set<string>,
  exitDate?: string | null
): number {
  const hire = hireDate ? new Date(`${hireDate}T00:00:00`) : null;
  const exit = exitDate ? new Date(`${exitDate}T00:00:00`) : null;
  const from = hire && hire > monthStart ? hire : monthStart;
  const to = exit && exit < monthEnd ? exit : monthEnd;
  if (from.getTime() === monthStart.getTime() && to.getTime() === monthEnd.getTime()) return 1;
  if (to < from) return 0;
  const totalWorkingDaysInMonth = countWorkingDays(monthStart, monthEnd, workingDays, holidaySet);
  const workedDays = countWorkingDays(from, to, workingDays, holidaySet);
  return totalWorkingDaysInMonth > 0 ? workedDays / totalWorkingDaysInMonth : 1;
}

/**
 * Whether someone is paid at all for the month: they joined by its last day
 * and hadn't left before its first day.
 */
export function isEmployedDuringMonth(
  hireDate: string | null | undefined,
  exitDate: string | null | undefined,
  monthStartStr: string,
  monthEndStr: string
): boolean {
  return (!hireDate || hireDate <= monthEndStr) && (!exitDate || exitDate >= monthStartStr);
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

export interface PayrollComponents {
  hra: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  tax_deduction: number;
  pf_deduction: number;
}

/**
 * The salary components for one payroll record, prorated like the totals.
 * Stored on the record so a later salary revision never changes an old payslip.
 */
export function prorateComponents(salary: SalaryComponents, ratio: number): PayrollComponents {
  const part = (value: number | string | null | undefined) => Math.round(Number(value || 0) * ratio * 100) / 100;
  return {
    hra: part(salary.hra),
    transport_allowance: part(salary.transport_allowance),
    medical_allowance: part(salary.medical_allowance),
    other_allowances: part(salary.other_allowances),
    tax_deduction: part(salary.tax_deduction),
    pf_deduction: part(salary.pf_deduction),
  };
}
