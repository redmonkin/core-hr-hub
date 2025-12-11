import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2 } from "lucide-react";
import { useLeaveBalances } from "@/hooks/useLeaveBalances";

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
              const remaining = balance.total_days - balance.used_days;
              const usedPercentage = balance.total_days > 0 
                ? (balance.used_days / balance.total_days) * 100 
                : 0;

              return (
                <div
                  key={balance.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{balance.leave_type?.name || "Leave"}</span>
                    {balance.leave_type?.is_paid && (
                      <Badge variant="secondary" className="text-xs">Paid</Badge>
                    )}
                  </div>
                  <Progress value={usedPercentage} className="h-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{balance.used_days} used</span>
                    <span className="font-medium text-foreground">{remaining} remaining</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: {balance.total_days} days/year
                  </p>
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
