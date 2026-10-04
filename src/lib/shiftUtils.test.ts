import { describe, expect, it } from "vitest";
import { getExpectedHours, getShiftEndTime, isCrossMidnightShift } from "./shiftUtils";

describe("getExpectedHours", () => {
  it("handles same-day shifts", () => {
    expect(getExpectedHours("09:00", "18:00")).toBe(9);
    expect(getExpectedHours("09:30", "18:00")).toBe(8.5);
  });

  it("handles cross-midnight shifts", () => {
    expect(getExpectedHours("14:00", "01:00")).toBe(11);
    expect(getExpectedHours("22:00", "06:30")).toBe(8.5);
  });

  it("treats identical start and end as a 24h shift", () => {
    expect(getExpectedHours("09:00", "09:00")).toBe(24);
  });

  it("accepts HH:MM:SS values from Postgres time columns", () => {
    expect(getExpectedHours("09:00:00", "17:30:00")).toBe(8.5);
  });
});

describe("isCrossMidnightShift", () => {
  it("detects shifts ending on the next day", () => {
    expect(isCrossMidnightShift("14:00", "01:00")).toBe(true);
    expect(isCrossMidnightShift("09:00", "09:00")).toBe(true);
  });

  it("returns false for same-day shifts", () => {
    expect(isCrossMidnightShift("09:00", "18:00")).toBe(false);
  });
});

describe("getShiftEndTime", () => {
  it("ends on the same day for day shifts", () => {
    const end = getShiftEndTime(new Date(2026, 8, 24, 9, 5), "09:00", "18:00");
    expect(end).toEqual(new Date(2026, 8, 24, 18, 0));
  });

  it("ends on the next day for cross-midnight shifts", () => {
    const end = getShiftEndTime(new Date(2026, 8, 24, 14, 2), "14:00", "01:00");
    expect(end).toEqual(new Date(2026, 8, 25, 1, 0));
  });

  it("rolls over month boundaries", () => {
    const end = getShiftEndTime(new Date(2026, 8, 30, 22, 0), "22:00", "06:00");
    expect(end).toEqual(new Date(2026, 9, 1, 6, 0));
  });

  it("does not mutate the clock-in time", () => {
    const clockIn = new Date(2026, 8, 24, 9, 0);
    getShiftEndTime(clockIn, "09:00", "18:00");
    expect(clockIn).toEqual(new Date(2026, 8, 24, 9, 0));
  });
});
