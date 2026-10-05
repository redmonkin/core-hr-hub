import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { subDays, subMonths, startOfYear, startOfQuarter, subQuarters, isSameDay } from "date-fns";

interface DatePresetsProps {
  onSelect: (start: Date, end: Date) => void;
  /** Current range, used to highlight the matching preset. */
  startDate?: Date;
  endDate?: Date;
}

const presets = [
  {
    label: "Last 30 days",
    getValue: () => ({
      start: subDays(new Date(), 30),
      end: new Date(),
    }),
  },
  {
    label: "Last quarter",
    getValue: () => ({
      start: startOfQuarter(subQuarters(new Date(), 1)),
      end: subQuarters(new Date(), 1),
    }),
  },
  {
    label: "Last 6 months",
    getValue: () => ({
      start: subMonths(new Date(), 6),
      end: new Date(),
    }),
  },
  {
    label: "This year",
    getValue: () => ({
      start: startOfYear(new Date()),
      end: new Date(),
    }),
  },
  {
    label: "All time",
    getValue: () => ({
      start: new Date(2020, 0, 1),
      end: new Date(),
    }),
  },
];

export function DatePresets({ onSelect, startDate, endDate }: DatePresetsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Date range presets">
      {presets.map((preset) => {
        const { start, end } = preset.getValue();
        const active =
          !!startDate && !!endDate && isSameDay(start, startDate) && isSameDay(end, endDate);
        return (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={active}
            className={cn(
              "h-9 rounded-full px-3 text-xs sm:h-8",
              active
                ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                : "text-muted-foreground",
            )}
            onClick={() => {
              const range = preset.getValue();
              onSelect(range.start, range.end);
            }}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
