import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXIT_REASONS, type ExitReason, useStartOffboarding } from "@/hooks/useOffboarding";

interface StartOffboardingDialogProps {
  employee: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export function StartOffboardingDialog({ employee, onOpenChange }: StartOffboardingDialogProps) {
  const start = useStartOffboarding();
  const [reason, setReason] = useState<ExitReason>("resignation");
  const [noticeDate, setNoticeDate] = useState(today());
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (employee) {
      setReason("resignation");
      setNoticeDate(today());
      setLastWorkingDay("");
      setNotes("");
    }
  }, [employee]);

  const firstName = employee?.name.split(" ")[0] ?? "";
  const datesInvalid = !!lastWorkingDay && lastWorkingDay < noticeDate;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !lastWorkingDay || datesInvalid) return;
    start.mutate(
      { employeeId: employee.id, reason, noticeDate, lastWorkingDay, notes },
      {
        onSuccess: () => {
          toast.success(`Offboarding started for ${employee.name}`, {
            description: `Their last working day is ${format(new Date(`${lastWorkingDay}T00:00:00`), "MMM d, yyyy")}. Track the checklist in Onboarding → Leaving.`,
          });
          onOpenChange(false);
        },
        onError: (error: Error) => toast.error("Couldn't start offboarding", { description: error.message }),
      },
    );
  };

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Start offboarding {employee?.name}</DialogTitle>
            <DialogDescription>
              {firstName} stays active until their last working day. The day after, they're marked as offboarded and
              their sign-in is blocked. A checklist (assets to return, final payroll and more) is created now.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="exit-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ExitReason)}>
              <SelectTrigger id="exit-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXIT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exit-notice-date">Notice date</Label>
              <Input
                id="exit-notice-date"
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit-last-day">Last working day *</Label>
              <Input
                id="exit-last-day"
                type="date"
                value={lastWorkingDay}
                min={noticeDate}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                aria-invalid={datesInvalid}
                aria-describedby={datesInvalid ? "exit-last-day-error" : undefined}
                required
              />
              {datesInvalid && (
                <p id="exit-last-day-error" className="text-xs text-destructive">
                  Can't be before the notice date.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exit-notes">Notes</Label>
            <Textarea
              id="exit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything HR should know (optional)"
              maxLength={2000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!lastWorkingDay || datesInvalid || start.isPending}>
              {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start offboarding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
