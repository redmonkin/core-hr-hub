// One place for status badge colours so every module renders them the same way.
// Use with <Badge variant="outline" className={statusBadgeClass(status)}>{formatStatus(status)}</Badge>

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

const STATUS_TONE: Record<string, Tone> = {
  // positive / done
  active: "success",
  approved: "success",
  paid: "success",
  completed: "success",
  present: "success",
  acknowledged: "success",
  available: "success",
  accepted: "success",
  // waiting on someone
  pending: "warning",
  submitted: "warning",
  in_progress: "info",
  processing: "info",
  onboarding: "info",
  assigned: "info",
  invited: "info",
  late: "warning",
  maintenance: "warning",
  half_day: "warning",
  // negative
  rejected: "danger",
  cancelled: "danger",
  terminated: "danger",
  blocked: "danger",
  absent: "danger",
  lost: "danger",
  expired: "danger",
  revoked: "danger",
  // neutral
  draft: "neutral",
  inactive: "neutral",
  retired: "neutral",
  not_started: "neutral",
  on_leave: "neutral",
  not_linked: "neutral",
};

export function statusTone(status: string | null | undefined): Tone {
  return STATUS_TONE[(status ?? "").toLowerCase().replace(/[\s-]+/g, "_")] ?? "neutral";
}

export function statusBadgeClass(status: string | null | undefined): string {
  return TONES[statusTone(status)];
}

export function toneClass(tone: Tone): string {
  return TONES[tone];
}

/** "in_progress" -> "In progress" */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return "";
  const text = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 day", "2 days", "0.5 days" */
export function pluralizeDays(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}
