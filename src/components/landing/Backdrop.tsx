import { cn } from "@/lib/utils";

interface BackdropProps {
  className?: string;
  /** "light" draws the grid in white, for dark or primary-coloured panels. */
  tone?: "default" | "light";
}

/** Decorative background: a faded grid with slowly drifting colour glows. */
export function Backdrop({ className, tone = "default" }: BackdropProps) {
  return (
    <div aria-hidden="true" className={cn("motion-decor pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className={cn("absolute inset-0 mask-fade-y", tone === "light" ? "bg-grid-light" : "bg-grid")} />
      <div className="absolute -left-[10%] -top-[20%] h-[55%] w-[55%] rounded-full bg-primary/20 blur-3xl animate-drift" />
      <div
        className="absolute -right-[10%] top-[10%] h-[45%] w-[45%] rounded-full bg-sky-300/30 blur-3xl animate-drift"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-[-25%] left-[25%] h-[45%] w-[50%] rounded-full bg-cyan-200/30 blur-3xl animate-drift"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
