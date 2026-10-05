// Badge colours for leave types and expense categories.
// These deliberately avoid the status hues (emerald / amber / red / sky from
// statusBadgeClass) so a "Travel" or "Casual leave" chip never reads as a status.

const PALETTE = {
  violet: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  pink: "border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
  orange: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  fuchsia: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  purple: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  slate: "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
} as const;

type PaletteKey = keyof typeof PALETTE;

const DOT: Record<PaletteKey, string> = {
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
  fuchsia: "bg-fuchsia-500",
  purple: "bg-purple-500",
  slate: "bg-slate-400",
};

const FALLBACK: PaletteKey[] = ["violet", "indigo", "pink", "orange", "cyan", "fuchsia", "purple"];

const LEAVE_TYPE_COLOR: Record<string, PaletteKey> = {
  annual: "violet",
  earned: "violet",
  privilege: "violet",
  sick: "pink",
  casual: "indigo",
  unpaid: "slate",
  maternity: "fuchsia",
  paternity: "cyan",
  bereavement: "purple",
  compensatory: "orange",
  "comp off": "orange",
  "work from home": "cyan",
  marriage: "fuchsia",
};

const CATEGORY_COLOR: Record<string, PaletteKey> = {
  travel: "indigo",
  food: "orange",
  accommodation: "violet",
  office_supplies: "cyan",
  other: "slate",
};

/** "Casual Leave" -> "casual" */
function normalizeLeaveType(type: string): string {
  return type.toLowerCase().replace(/\s+leave$/, "").trim();
}

function hashKey(value: string): PaletteKey {
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK[hash % FALLBACK.length];
}

function leaveTypeKey(type: string): PaletteKey {
  const key = normalizeLeaveType(type);
  return LEAVE_TYPE_COLOR[key] ?? hashKey(key);
}

export function leaveTypeBadgeClass(type: string): string {
  return PALETTE[leaveTypeKey(type)];
}

export function leaveTypeDotClass(type: string): string {
  return DOT[leaveTypeKey(type)];
}

export function categoryBadgeClass(category: string): string {
  return PALETTE[CATEGORY_COLOR[category] ?? hashKey(category)];
}
