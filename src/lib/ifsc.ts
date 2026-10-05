/** IFSC: 4-letter bank code, a zero, then a 6-character branch code (e.g. HDFC0001234). */
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Upper-cases and strips spaces, so "hdfc 0001234" becomes "HDFC0001234". */
export const normalizeIfsc = (value: string): string => value.replace(/\s+/g, "").toUpperCase();

export const isValidIfsc = (value: string): boolean => IFSC_PATTERN.test(normalizeIfsc(value));
