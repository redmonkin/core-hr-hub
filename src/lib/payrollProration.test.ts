import { describe, expect, it } from "vitest";
import {
  buildHolidaySet,
  calculatePayrollAmounts,
  countWorkingDays,
  getProrationRatio,
  resolveWorkingDays,
} from "./payrollProration";

// September 2026 runs Tue 1st – Wed 30th and has 22 weekdays.
const SEP_START = new Date(2026, 8, 1);
const SEP_END = new Date(2026, 9, 0);
const MON_FRI = [1, 2, 3, 4, 5];

describe("buildHolidaySet", () => {
  it("adds a single-day holiday as its local date string", () => {
    const set = buildHolidaySet([{ event_date: "2026-09-17", end_date: null }], SEP_START, SEP_END);
    expect([...set]).toEqual(["2026-09-17"]);
  });

  it("expands multi-day holidays inclusively", () => {
    const set = buildHolidaySet([{ event_date: "2026-09-21", end_date: "2026-09-23" }], SEP_START, SEP_END);
    expect([...set]).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
  });

  it("clips holidays that straddle the month boundaries", () => {
    const set = buildHolidaySet(
      [
        { event_date: "2026-08-30", end_date: "2026-09-02" },
        { event_date: "2026-09-29", end_date: "2026-10-03" },
      ],
      SEP_START,
      SEP_END
    );
    expect([...set]).toEqual(["2026-09-01", "2026-09-02", "2026-09-29", "2026-09-30"]);
  });

  it("ignores holidays entirely outside the month", () => {
    const set = buildHolidaySet([{ event_date: "2026-08-15", end_date: null }], SEP_START, SEP_END);
    expect(set.size).toBe(0);
  });
});

describe("countWorkingDays", () => {
  it("counts weekdays in a full month", () => {
    expect(countWorkingDays(SEP_START, SEP_END, MON_FRI, new Set())).toBe(22);
  });

  it("excludes holidays that fall on working days", () => {
    expect(countWorkingDays(SEP_START, SEP_END, MON_FRI, new Set(["2026-09-17"]))).toBe(21);
  });

  it("ignores holidays that fall on non-working days", () => {
    // 2026-09-19 is a Saturday
    expect(countWorkingDays(SEP_START, SEP_END, MON_FRI, new Set(["2026-09-19"]))).toBe(22);
  });

  it("respects custom working-day patterns (Mon–Sat)", () => {
    // 22 weekdays + 4 Saturdays (5, 12, 19, 26)
    expect(countWorkingDays(SEP_START, SEP_END, [1, 2, 3, 4, 5, 6], new Set())).toBe(26);
  });

  it("is inclusive of both start and end", () => {
    const day = new Date(2026, 8, 15);
    expect(countWorkingDays(day, day, MON_FRI, new Set())).toBe(1);
  });

  it("does not mutate the start date", () => {
    const start = new Date(2026, 8, 1);
    countWorkingDays(start, SEP_END, MON_FRI, new Set());
    expect(start.getDate()).toBe(1);
  });
});

describe("resolveWorkingDays", () => {
  it("defaults to Mon–Fri when missing or empty", () => {
    expect(resolveWorkingDays(null)).toEqual(MON_FRI);
    expect(resolveWorkingDays(undefined)).toEqual(MON_FRI);
    expect(resolveWorkingDays([])).toEqual(MON_FRI);
  });

  it("keeps a configured pattern", () => {
    expect(resolveWorkingDays([0, 6])).toEqual([0, 6]);
  });
});

describe("getProrationRatio", () => {
  const none = new Set<string>();

  it("is 1 when there is no hire date", () => {
    expect(getProrationRatio(null, SEP_START, SEP_END, MON_FRI, none)).toBe(1);
  });

  it("is 1 for employees hired before the month", () => {
    expect(getProrationRatio("2025-01-10", SEP_START, SEP_END, MON_FRI, none)).toBe(1);
  });

  it("is 1 for employees hired on the 1st", () => {
    expect(getProrationRatio("2026-09-01", SEP_START, SEP_END, MON_FRI, none)).toBe(1);
  });

  it("prorates mid-month joiners by working days", () => {
    // Hired Tue 15th: 15–18, 21–25, 28–30 = 12 of 22 weekdays
    expect(getProrationRatio("2026-09-15", SEP_START, SEP_END, MON_FRI, none)).toBeCloseTo(12 / 22);
  });

  it("removes holidays from both worked and total days", () => {
    const holidays = buildHolidaySet([{ event_date: "2026-09-17", end_date: null }], SEP_START, SEP_END);
    expect(getProrationRatio("2026-09-15", SEP_START, SEP_END, MON_FRI, holidays)).toBeCloseTo(11 / 21);
  });

  it("counts a holiday before the hire date only in the total", () => {
    const holidays = buildHolidaySet([{ event_date: "2026-09-02", end_date: null }], SEP_START, SEP_END);
    expect(getProrationRatio("2026-09-15", SEP_START, SEP_END, MON_FRI, holidays)).toBeCloseTo(12 / 21);
  });

  it("gives one day's pay to someone hired on the last working day", () => {
    expect(getProrationRatio("2026-09-30", SEP_START, SEP_END, MON_FRI, none)).toBeCloseTo(1 / 22);
  });

  it("is 0 for someone hired on a non-working last day of the month", () => {
    // February 2026 ends on Saturday the 28th
    const febStart = new Date(2026, 1, 1);
    const febEnd = new Date(2026, 2, 0);
    expect(getProrationRatio("2026-02-28", febStart, febEnd, MON_FRI, none)).toBe(0);
  });

  it("falls back to 1 when the month has no working days", () => {
    expect(getProrationRatio("2026-09-15", SEP_START, SEP_END, [], none)).toBe(1);
  });
});

describe("calculatePayrollAmounts", () => {
  const salary = {
    basic_salary: 50000,
    hra: 20000,
    transport_allowance: 2000,
    medical_allowance: 1250,
    other_allowances: 750,
    tax_deduction: 5000,
    pf_deduction: 1800,
  };

  it("computes full-month totals", () => {
    expect(calculatePayrollAmounts(salary, 1)).toEqual({
      basic_salary: 50000,
      total_allowances: 24000,
      total_deductions: 6800,
      net_salary: 67200,
    });
  });

  it("scales every component by the ratio", () => {
    const amounts = calculatePayrollAmounts(salary, 0.5);
    expect(amounts.basic_salary).toBe(25000);
    expect(amounts.total_allowances).toBe(12000);
    expect(amounts.total_deductions).toBe(3400);
    expect(amounts.net_salary).toBe(33600);
  });

  it("treats null components as zero", () => {
    expect(
      calculatePayrollAmounts(
        { basic_salary: 30000, hra: null, transport_allowance: null, tax_deduction: null, pf_deduction: null },
        1
      )
    ).toEqual({ basic_salary: 30000, total_allowances: 0, total_deductions: 0, net_salary: 30000 });
  });

  it("accepts numeric strings (Postgres numeric columns)", () => {
    expect(calculatePayrollAmounts({ basic_salary: "40000.50", hra: "10000" }, 1).net_salary).toBeCloseTo(50000.5);
  });
});
