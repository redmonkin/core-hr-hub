import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: 0, label: "Sun", name: "Sunday" },
  { value: 1, label: "Mon", name: "Monday" },
  { value: 2, label: "Tue", name: "Tuesday" },
  { value: 3, label: "Wed", name: "Wednesday" },
  { value: 4, label: "Thu", name: "Thursday" },
  { value: 5, label: "Fri", name: "Friday" },
  { value: 6, label: "Sat", name: "Saturday" },
];

interface WorkingDaysPickerProps {
  value: number[];
  onChange?: (days: number[]) => void;
  disabled?: boolean;
  /** Read-only display (no interaction, same visual). */
  readOnly?: boolean;
  /** id of the visible label, for the group's accessible name. */
  labelledBy?: string;
  className?: string;
}

/** Toggle pills for picking working days. Shared by Onboarding, Profile and Edit employee. */
export function WorkingDaysPicker({
  value,
  onChange,
  disabled,
  readOnly,
  labelledBy,
  className,
}: WorkingDaysPickerProps) {
  const toggle = (day: number) => {
    const next = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day].sort((a, b) => a - b);
    onChange?.(next);
  };

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Working days"}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {WEEKDAYS.map((day) => {
        const selected = value.includes(day.value);
        const classes = cn(
          "inline-flex h-10 min-w-[3rem] items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors sm:h-9",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background text-foreground",
        );
        if (readOnly) {
          return (
            <span
              key={day.value}
              className={cn(classes, !selected && "text-muted-foreground")}
              title={`${day.name}: ${selected ? "working day" : "day off"}`}
            >
              <span aria-hidden="true">{day.label}</span>
              <span className="sr-only">{`${day.name}: ${selected ? "working day" : "day off"}`}</span>
            </span>
          );
        }
        return (
          <button
            key={day.value}
            type="button"
            aria-pressed={selected}
            aria-label={day.name}
            disabled={disabled}
            onClick={() => toggle(day.value)}
            className={cn(
              classes,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              !selected && "hover:bg-accent",
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
