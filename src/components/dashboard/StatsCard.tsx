import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: ReactNode;
  variant?: "default" | "primary" | "success" | "warning";
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  variant = "default",
  className,
}: StatsCardProps) {
  const iconBgClasses = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-700",
    warning: "bg-amber-500/10 text-amber-700",
  };

  return (
    <Card className={cn("h-full overflow-hidden transition-all duration-300 hover:shadow-lg", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1 sm:space-y-2">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
            <p className="text-xl font-bold text-foreground sm:text-3xl">{value}</p>
            {change && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  change.type === "increase" ? "text-emerald-600" : "text-destructive"
                )}
              >
                {change.type === "increase" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(change.value)}%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 sm:rounded-xl [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-6 sm:[&_svg]:w-6",
              iconBgClasses[variant]
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
