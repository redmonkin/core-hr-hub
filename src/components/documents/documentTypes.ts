// Document types stored in employee_documents.document_type (free-text column).
// Keep legacy values readable so existing rows still display with a sensible label.

export const GENERAL_DOCUMENT_TYPES = [
  { value: "id_proof", label: "ID proof" },
  { value: "resume", label: "Resume" },
  { value: "offer_letter", label: "Offer letter" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

/** Indian payroll tax documents. */
export const TAX_DOCUMENT_TYPES = [
  { value: "form_16", label: "Form 16" },
  { value: "form_12bb", label: "Form 12BB" },
  { value: "form_26as", label: "Form 26AS" },
  { value: "investment_proof", label: "Investment proofs" },
  { value: "tax_statement", label: "Tax statement" },
];

/** Older tax values (US forms / title-cased) that may already exist in the database. */
const LEGACY_TAX_TYPES = [
  { value: "Tax Statement", label: "Tax statement" },
  { value: "Tax Certificate", label: "Tax certificate" },
  { value: "W-2", label: "W-2" },
  { value: "1099", label: "1099" },
];

/** Every value the tax documents viewer should pick up. */
export const TAX_DOCUMENT_TYPE_VALUES = [...TAX_DOCUMENT_TYPES, ...LEGACY_TAX_TYPES].map((t) => t.value);

/** Types HR can choose when uploading. */
export const UPLOADABLE_DOCUMENT_TYPES = [...GENERAL_DOCUMENT_TYPES, ...TAX_DOCUMENT_TYPES];

const LABELS = new Map(
  [...GENERAL_DOCUMENT_TYPES, ...TAX_DOCUMENT_TYPES, ...LEGACY_TAX_TYPES].map((t) => [t.value, t.label]),
);

export function documentTypeLabel(type: string): string {
  return LABELS.get(type) ?? type.replace(/_/g, " ");
}
