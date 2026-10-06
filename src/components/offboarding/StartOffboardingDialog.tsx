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
import {
  defaultRecipientIds,
  EXIT_REASONS,
  type ExitReason,
  type ExitRecipients,
  useStartOffboarding,
} from "@/hooks/useOffboarding";
import { OffboardingEmailFields } from "./OffboardingEmailFields";

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
  const [recipients, setRecipients] = useState<ExitRecipients>({ employeeIds: [], emails: [] });
  const [emailNote, setEmailNote] = useState("");

  useEffect(() => {
    if (!employee) return;
    setReason("resignation");
    setNoticeDate(today());
    setLastWorkingDay("");
    setNotes("");
    setEmailNote("");
    setRecipients({ employeeIds: [], emails: [] });
    let cancelled = false;
    // Start with the reporting manager and the department managers
    defaultRecipientIds(employee.id)
      .then((ids) => !cancelled && setRecipients({ employeeIds: ids, emails: [] }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [employee]);

  const firstName = employee?.name.split(" ")[0] ?? "";
  const datesInvalid = !!lastWorkingDay && lastWorkingDay < noticeDate;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !lastWorkingDay || datesInvalid) return;
    start.mutate(
      { employeeId: employee.id, reason, noticeDate, lastWorkingDay, notes, emailNote, recipients },
      {
        onSuccess: (result) => {
          const lwd = format(new Date(`${lastWorkingDay}T00:00:00`), "MMM d, yyyy");
          if (result.emailError) {
            toast.warning(`Offboarding started for ${employee.name}, but the email wasn't sent`, {
              description: `${result.emailError} You can resend it from Onboarding → Leaving.`,
            });
          } else {
            toast.success(`Offboarding started for ${employee.name}`, {
              description: result.emailed
                ? `Last working day ${lwd}. The checklist was emailed to ${result.emailed} ${result.emailed === 1 ? "person" : "people"}.`
                : `Last working day ${lwd}. No email was sent.`,
            });
          }
          onOpenChange(false);
        },
        onError: (error: Error) => toast.error("Couldn't start offboarding", { description: error.message }),
      },
    );
  };

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Start offboarding {employee?.name}</DialogTitle>
            <DialogDescription>
              {firstName} stays active until their last working day. The day after, they're marked as offboarded and
              their sign-in is blocked.
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
            <Label htmlFor="exit-notes">Internal notes</Label>
            <Textarea
              id="exit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="For HR only, not included in the email (optional)"
              maxLength={2000}
              rows={3}
            />
          </div>

          {employee && (
            <OffboardingEmailFields
              idPrefix="start"
              employeeId={employee.id}
              reason={reason}
              lastWorkingDay={lastWorkingDay}
              recipients={recipients}
              onRecipientsChange={setRecipients}
              note={emailNote}
              onNoteChange={setEmailNote}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!lastWorkingDay || datesInvalid || start.isPending}>
              {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {recipients.employeeIds.length + recipients.emails.length > 0 ? "Start and email checklist" : "Start offboarding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
