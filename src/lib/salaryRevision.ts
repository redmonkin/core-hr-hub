// Salary revisions: labels and the arithmetic shown in the UI and the revision letter.

export type SalaryRevisionType = "annual_appraisal" | "promotion" | "market_correction" | "adjustment" | "other";
export type SalaryRevisionStatus = "pending_approval" | "scheduled" | "applied" | "rejected" | "cancelled";

export const REVISION_TYPES: { value: SalaryRevisionType; label: string }[] = [
  { value: "annual_appraisal", label: "Annual appraisal" },
  { value: "promotion", label: "Promotion" },
  { value: "market_correction", label: "Market correction" },
  { value: "adjustment", label: "Adjustment" },
  { value: "other", label: "Other" },
];

export function revisionTypeLabel(type: string): string {
  return REVISION_TYPES.find((t) => t.value === type)?.label ?? "Salary revision";
}

export const REVISION_STATUS_LABELS: Record<SalaryRevisionStatus, string> = {
  pending_approval: "Awaiting approval",
  scheduled: "Scheduled",
  applied: "Applied",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Badge tone key for statusBadgeClass(). */
export function revisionStatusTone(status: SalaryRevisionStatus): string {
  return status === "pending_approval" ? "pending" : status === "scheduled" ? "in_progress" : status === "applied" ? "approved" : status;
}

/** Monthly salary components, as stored on salary_structures and salary_revisions. */
export interface SalaryComponents {
  basic_salary: number;
  hra: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  tax_deduction: number;
  pf_deduction: number;
}

export const COMPONENT_FIELDS: { key: keyof SalaryComponents; label: string; kind: "earning" | "deduction" }[] = [
  { key: "basic_salary", label: "Basic salary", kind: "earning" },
  { key: "hra", label: "HRA", kind: "earning" },
  { key: "transport_allowance", label: "Transport allowance", kind: "earning" },
  { key: "medical_allowance", label: "Medical allowance", kind: "earning" },
  { key: "other_allowances", label: "Other allowances", kind: "earning" },
  { key: "tax_deduction", label: "Tax", kind: "deduction" },
  { key: "pf_deduction", label: "PF", kind: "deduction" },
];

/** Reads components from any row-like object (numeric strings and nulls allowed). */
export function toComponents(source: Partial<Record<keyof SalaryComponents, unknown>> | null | undefined): SalaryComponents {
  const n = (v: unknown) => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
  };
  return {
    basic_salary: n(source?.basic_salary),
    hra: n(source?.hra),
    transport_allowance: n(source?.transport_allowance),
    medical_allowance: n(source?.medical_allowance),
    other_allowances: n(source?.other_allowances),
    tax_deduction: n(source?.tax_deduction),
    pf_deduction: n(source?.pf_deduction),
  };
}

export function grossOf(c: SalaryComponents): number {
  return c.basic_salary + c.hra + c.transport_allowance + c.medical_allowance + c.other_allowances;
}

export function deductionsOf(c: SalaryComponents): number {
  return c.tax_deduction + c.pf_deduction;
}

export function netOf(c: SalaryComponents): number {
  return grossOf(c) - deductionsOf(c);
}

/** Percentage change from `before` to `after`, or null when there's no base to compare with. */
export function percentChange(before: number, after: number): number | null {
  if (!before) return null;
  return ((after - before) / before) * 100;
}

/** "+12.5%", "-3.0%", "0.0%" */
export function formatPercent(pct: number | null): string {
  if (pct === null) return "—";
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

/** Scales every earning by the same percentage (deductions stay as they are), rounded to the rupee. */
export function applyIncrement(c: SalaryComponents, pct: number): SalaryComponents {
  const factor = 1 + pct / 100;
  const scale = (v: number) => Math.max(0, Math.round(v * factor));
  return {
    ...c,
    basic_salary: scale(c.basic_salary),
    hra: scale(c.hra),
    transport_allowance: scale(c.transport_allowance),
    medical_allowance: scale(c.medical_allowance),
    other_allowances: scale(c.other_allowances),
  };
}

export function sameComponents(a: SalaryComponents, b: SalaryComponents): boolean {
  return COMPONENT_FIELDS.every(({ key }) => a[key] === b[key]);
}
