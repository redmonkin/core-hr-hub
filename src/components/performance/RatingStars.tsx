import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
  label?: string;
}

export function RatingStars({ value, onChange, readonly = false, size = "md", label }: RatingStarsProps) {
  const starSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const subject = label ? `${label} rating` : "Rating";
  const summary = value ? `${subject}: ${value} of 5` : `${subject}: not rated`;

  const renderStar = (star: number) => (
    <Star
      aria-hidden="true"
      className={cn(
        starSize,
        star <= (value || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
      )}
    />
  );

  return (
    <div className="flex items-center gap-1">
      {label && <span className="mr-1 text-xs text-muted-foreground" aria-hidden="true">{label}:</span>}
      {readonly ? (
        <div className="flex items-center gap-1" role="img" aria-label={summary}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star}>{renderStar(star)}</span>
          ))}
        </div>
      ) : (
        <div className="flex items-center" role="group" aria-label={summary}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              aria-label={`${subject}: ${star} of 5`}
              aria-pressed={value === star}
              className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {renderStar(star)}
            </button>
          ))}
        </div>
      )}
      {value !== null && value !== undefined && (
        <span className="ml-1 text-xs font-medium text-muted-foreground" aria-hidden="true">{value}/5</span>
      )}
    </div>
  );
}
