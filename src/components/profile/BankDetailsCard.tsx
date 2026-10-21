import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

/** "•••• 4321": shows only the last four digits. */
function maskAccountNumber(value: string): string {
  const digits = value.replace(/\s+/g, "");
  return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`;
}

/** The employee's own bank details, read-only. Changes go through HR (payroll). */
export function BankDetailsCard({ employeeId }: { employeeId: string }) {
  const [revealed, setRevealed] = useState(false);
  const { data: bank, isLoading } = useQuery({
    queryKey: ["my-bank-details", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_bank_details")
        .select("bank_name, bank_account_number, ifsc_code")
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hasDetails = !!(bank?.bank_name || bank?.bank_account_number || bank?.ifsc_code);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Bank details
        </CardTitle>
        <CardDescription>Where your salary is paid. Contact HR to add or change these.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !hasDetails ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            No bank details on file yet. Send them to HR so your salary can be paid.
          </p>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Bank name</dt>
              <dd className="truncate font-medium text-foreground">{bank?.bank_name || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Account number</dt>
              <dd className="flex items-center gap-1 font-medium tabular-nums text-foreground">
                <span className="truncate">
                  {bank?.bank_account_number
                    ? revealed
                      ? bank.bank_account_number
                      : maskAccountNumber(bank.bank_account_number)
                    : "—"}
                </span>
                {bank?.bank_account_number && bank.bank_account_number.replace(/\s+/g, "").length > 4 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setRevealed((v) => !v)}
                    aria-label={revealed ? "Hide account number" : "Show account number"}
                    aria-pressed={revealed}
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">IFSC code</dt>
              <dd className="font-medium tabular-nums text-foreground">{bank?.ifsc_code || "—"}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
