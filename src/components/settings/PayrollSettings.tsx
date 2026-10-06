import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSalaryRevisionApproval, useSetSalaryRevisionApproval } from "@/hooks/useSalaryRevisions";

export function PayrollSettings() {
  const { data: enabled = false, isLoading } = useSalaryRevisionApproval();
  const setApproval = useSetSalaryRevisionApproval();

  const toggle = (next: boolean) =>
    setApproval.mutate(next, {
      onSuccess: () =>
        toast.success(next ? "Salary revisions now need approval" : "Salary revisions no longer need approval"),
      onError: (error: Error) => toast.error("Couldn't save the setting", { description: error.message }),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll</CardTitle>
        <CardDescription>How pay changes are agreed.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <Label htmlFor="salary-revision-approval" className="text-sm font-medium">
              Require approval for salary revisions
            </Label>
            <p className="text-sm text-muted-foreground">
              A revision waits until another person with payroll access approves it. Nobody approves a revision they
              proposed or one to their own salary. Setting up someone's first salary doesn't need approval.
            </p>
            <p className="text-xs text-muted-foreground">
              Revisions already waiting stay waiting if you turn this off; approve or cancel them on the Payroll page.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {(isLoading || setApproval.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
            <Switch
              id="salary-revision-approval"
              checked={enabled}
              onCheckedChange={toggle}
              disabled={isLoading || setApproval.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
