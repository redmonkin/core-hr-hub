// HTML-escape any value before interpolating it into an email template.
// Numbers, dates and booleans are converted to strings first; null/undefined
// become an empty string.
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
