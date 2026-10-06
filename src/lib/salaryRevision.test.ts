import { describe, expect, it } from "vitest";
import {
  applyIncrement,
  formatPercent,
  grossOf,
  netOf,
  percentChange,
  revisionTypeLabel,
  sameComponents,
  toComponents,
} from "./salaryRevision";

const base = toComponents({
  basic_salary: "30000",
  hra: 10000,
  transport_allowance: null,
  medical_allowance: 1250,
  other_allowances: 0,
  tax_deduction: 2000,
  pf_deduction: 1800,
});

describe("salary revision helpers", () => {
  it("reads components from rows with strings and nulls", () => {
    expect(base.basic_salary).toBe(30000);
    expect(base.transport_allowance).toBe(0);
  });

  it("computes gross and net", () => {
    expect(grossOf(base)).toBe(41250);
    expect(netOf(base)).toBe(37450);
  });

  it("computes and formats the change", () => {
    expect(percentChange(40000, 44000)).toBeCloseTo(10);
    expect(percentChange(0, 1000)).toBeNull();
    expect(formatPercent(10)).toBe("+10.0%");
    expect(formatPercent(-2.345)).toBe("-2.3%");
    expect(formatPercent(null)).toBe("—");
  });

  it("applies an increment to earnings only", () => {
    const raised = applyIncrement(base, 10);
    expect(raised.basic_salary).toBe(33000);
    expect(raised.hra).toBe(11000);
    expect(raised.medical_allowance).toBe(1375);
    expect(raised.tax_deduction).toBe(2000);
    expect(raised.pf_deduction).toBe(1800);
  });

  it("compares components", () => {
    expect(sameComponents(base, { ...base })).toBe(true);
    expect(sameComponents(base, { ...base, hra: 1 })).toBe(false);
  });

  it("labels revision types", () => {
    expect(revisionTypeLabel("annual_appraisal")).toBe("Annual appraisal");
    expect(revisionTypeLabel("unknown")).toBe("Salary revision");
  });
});
