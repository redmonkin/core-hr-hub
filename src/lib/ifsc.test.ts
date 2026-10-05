import { describe, expect, it } from "vitest";
import { isValidIfsc, normalizeIfsc } from "./ifsc";

describe("IFSC", () => {
  it("accepts valid codes, in any case and with spaces", () => {
    expect(isValidIfsc("HDFC0001234")).toBe(true);
    expect(isValidIfsc("sbin0ABC123")).toBe(true);
    expect(isValidIfsc(" icic 0000104 ")).toBe(true);
  });

  it("rejects codes with the wrong shape", () => {
    expect(isValidIfsc("HDFC1001234")).toBe(false); // 5th character must be 0
    expect(isValidIfsc("HDF00001234")).toBe(false); // bank code is 4 letters
    expect(isValidIfsc("HDFC000123")).toBe(false); // too short
    expect(isValidIfsc("")).toBe(false);
  });

  it("normalizes to upper case without spaces", () => {
    expect(normalizeIfsc(" hdfc 0001234 ")).toBe("HDFC0001234");
  });
});
