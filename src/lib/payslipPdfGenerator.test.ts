import { describe, expect, it } from "vitest";
import { payslipDate } from "./payslipPdfGenerator";

describe("payslipDate", () => {
  it("is the last day of the pay month", () => {
    expect(payslipDate("September", 2026)).toEqual(new Date(2026, 8, 30));
    expect(payslipDate("December", 2026)).toEqual(new Date(2026, 11, 31));
  });

  it("handles leap years", () => {
    expect(payslipDate("February", 2028)).toEqual(new Date(2028, 1, 29));
    expect(payslipDate("February", 2026)).toEqual(new Date(2026, 1, 28));
  });

  it("returns null for an unknown month", () => {
    expect(payslipDate("", 2026)).toBeNull();
  });
});
