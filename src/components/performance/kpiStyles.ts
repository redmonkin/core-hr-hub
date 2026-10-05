import { format } from "date-fns";
import { toneClass } from "@/lib/statusStyles";

/** Shared KPI badge helpers so the employee and team views render priority/due dates identically. */

export function priorityBadgeClass(priority: string | null | undefined): string {
  switch ((priority ?? "").toLowerCase()) {
    case "high":
      return toneClass("danger");
    case "medium":
      return toneClass("warning");
    default:
      return toneClass("neutral");
  }
}

/** "high" -> "High priority" */
export function formatPriority(priority: string | null | undefined): string {
  const p = (priority ?? "medium").toLowerCase();
  return `${p.charAt(0).toUpperCase()}${p.slice(1)} priority`;
}

/** "Due Oct 5, 2026" */
export function formatDueDate(date: string): string {
  return `Due ${format(new Date(date), "MMM d, yyyy")}`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
