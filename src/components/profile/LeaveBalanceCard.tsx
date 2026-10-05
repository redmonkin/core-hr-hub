import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2 } from "lucide-react";
import { useLeaveBalances } from "@/hooks/useLeaveBalances";
import { pluralizeDays } from "@/lib/statusStyles";

interface LeaveBalanceCardProps {
  employeeId: string;
}

export function LeaveBalanceCard({ employeeId }: LeaveBalanceCardProps) {
  const { data: balances, isLoading } = useLeaveBalances(employeeId);
  const currentYear = new Date().getFullYear();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Leave Balance
        </CardTitle>
        <CardDescription>Your available leave days for {currentYear}</CardDescription>
      </CardHeader>
      <CardContent>
        {balances && balances.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => {
              const name = balance.leave_type?.name || "Leave";
              // Unpaid leave has no allowance (days_per_year = 0) — it's unlimited, same as in the request form.
              const isUnlimited = balance.leave_type?.is_paid === false && balance.total_days <= 0;
              const remaining = Math.max(balance.total_days - balance.used_days, 0);
              const usedPercentage = balance.total_days > 0
                ? Math.min((balance.used_days / balance.total_days) * 100, 100)
                : 0;

              return (
                <div
                  key={balance.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{name}</span>
                    {balance.leave_type?.is_paid ? (
                      <Badge variant="secondary" className="text-xs">Paid</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Unpaid</Badge>
                    )}
                  </div>
                  {isUnlimited ? (
                    <>
                      <div className="h-2 rounded-full border border-dashed border-border" aria-hidden="true" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{balance.used_days} used</span>
                        <span className="font-medium text-foreground">Unlimited</span>
                      </div>
                      <p className="text-xs text-muted-foreground">No yearly limit</p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={usedPercentage}
                        className="h-2"
                        aria-label={`${name}: ${balance.used_days} of ${balance.total_days} days used`}
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{balance.used_days} used</span>
                        <span className="font-medium text-foreground">{remaining} remaining</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total: {pluralizeDays(balance.total_days)}/year
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No leave balances set up yet</p>
            <p className="text-sm">Contact HR to configure your leave entitlements</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
