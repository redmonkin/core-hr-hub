import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, DoorOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { toneClass } from "@/lib/statusStyles";
import { useMyExit, useResign, useUpdateExit } from "@/hooks/useOffboarding";

const fmt = (date: string) => format(parseISO(date), "MMM d, yyyy");

/** Lets an employee resign (HR approves) and shows where their resignation stands. */
export function ResignationCard({ employeeId }: { employeeId: string }) {
  const { data: exit, isLoading } = useMyExit(employeeId);
  const resign = useResign();
  const updateExit = useUpdateExit();
  const [resignOpen, setResignOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [lastDay, setLastDay] = useState("");
  const [notes, setNotes] = useState("");

  if (isLoading) return null;

  const today = format(new Date(), "yyyy-MM-dd");

  if (exit?.status === "in_progress") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DoorOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Your last working day is {fmt(exit.last_working_day)}
          </CardTitle>
          <CardDescription>
            HR is handling your offboarding. You can use Peoplo until the end of that day; download any payslips or
            documents you need before then.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (exit?.status === "requested") {
    return (
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Resignation submitted
              <Badge variant="outline" className={toneClass("warning")}>
                Waiting for HR
              </Badge>
            </CardTitle>
            <CardDescription>
              Submitted {fmt(exit.created_at.slice(0, 10))}. HR will confirm your last working day.
            </CardDescription>
          </div>
          <Button variant="outline" className="h-10 sm:h-9" onClick={() => setWithdrawOpen(true)}>
            Withdraw
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Proposed last day: {fmt(exit.last_working_day)}
          </p>
          {exit.notes && <p className="text-muted-foreground">“{exit.notes}”</p>}
        </CardContent>

        <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw your resignation?</AlertDialogTitle>
              <AlertDialogDescription>HR is told it's withdrawn. You can resign again later.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  updateExit.mutate(
                    { id: exit.id, status: "cancelled" },
                    {
                      onSuccess: () => toast.success("Resignation withdrawn"),
                      onError: (e: Error) => toast.error("Couldn't withdraw", { description: e.message }),
                    },
                  )
                }
              >
                Withdraw resignation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Leaving the company?</CardTitle>
          <CardDescription>
            {exit?.status === "declined"
              ? `Your last resignation wasn't accepted${exit.decision_notes ? `: “${exit.decision_notes}”` : "."}`
              : "Submit your resignation here. HR reviews it and confirms your last working day."}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="h-10 shrink-0 sm:h-9"
          onClick={() => {
            setLastDay("");
            setNotes("");
            setResignOpen(true);
          }}
        >
          Resign
        </Button>
      </CardHeader>

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lastDay) return;
              resign.mutate(
                { employeeId, lastWorkingDay: lastDay, notes },
                {
                  onSuccess: () => {
                    toast.success("Resignation submitted", { description: "HR will confirm your last working day." });
                    setResignOpen(false);
                  },
                  onError: (e: Error) => toast.error("Couldn't submit your resignation", { description: e.message }),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Resign</DialogTitle>
              <DialogDescription>
                Propose your last working day. HR reviews your resignation and confirms the date; you can withdraw it
                until they do.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="resign-last-day">Proposed last working day *</Label>
              <Input
                id="resign-last-day"
                type="date"
                min={today}
                value={lastDay}
                onChange={(e) => setLastDay(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resign-notes">Message to HR</Label>
              <Textarea
                id="resign-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                maxLength={2000}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!lastDay || resign.isPending}>
                {resign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit resignation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
