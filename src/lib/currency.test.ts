import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber } from "./currency";

describe("formatCurrency", () => {
  it("formats rupees with Indian digit grouping and no decimals by default", () => {
    expect(formatCurrency(1234567)).toBe("₹12,34,567");
  });

  it("rounds away decimals by default", () => {
    expect(formatCurrency(1499.6)).toBe("₹1,500");
  });

  it("shows two decimals when asked", () => {
    expect(formatCurrency(1234.5, true)).toBe("₹1,234.50");
  });

  it("formats negatives", () => {
    expect(formatCurrency(-2500)).toBe("-₹2,500");
  });
});

describe("formatNumber", () => {
  it("uses lakh/crore grouping", () => {
    expect(formatNumber(12345678)).toBe("1,23,45,678");
  });
});
