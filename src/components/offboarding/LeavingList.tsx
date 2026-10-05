import { useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  DoorOpen,
  Loader2,
  Plus,
  UserMinus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toneClass } from "@/lib/statusStyles";
import {
  type EmployeeExit,
  exitReasonLabel,
  useAddExitTask,
  useCompleteExit,
  useEmployeeExits,
  useToggleExitTask,
  useUpdateExit,
} from "@/hooks/useOffboarding";

const fmt = (date: string) => format(parseISO(date), "MMM d, yyyy");
const nameOf = (x: EmployeeExit) => (x.employee ? `${x.employee.first_name} ${x.employee.last_name}` : "Employee");
const initialsOf = (x: EmployeeExit) =>
  x.employee ? `${x.employee.first_name[0] ?? ""}${x.employee.last_name[0] ?? ""}`.toUpperCase() : "?";

function lastDayText(lastWorkingDay: string) {
  const days = differenceInCalendarDays(parseISO(lastWorkingDay), new Date());
  if (days > 1) return { text: `in ${days} days`, tone: "info" as const };
  if (days === 1) return { text: "tomorrow", tone: "warning" as const };
  if (days === 0) return { text: "today", tone: "warning" as const };
  return { text: "passed, completes overnight", tone: "danger" as const };
}

function PersonHeader({ exit }: { exit: EmployeeExit }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initialsOf(exit)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{nameOf(exit)}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[exit.employee?.designation, exit.employee?.department?.name].filter(Boolean).join(" · ") || "No role set"}
        </p>
      </div>
    </div>
  );
}

interface LeavingListProps {
  canManage: boolean;
}

export function LeavingList({ canManage }: LeavingListProps) {
  const { data: exits = [], isLoading } = useEmployeeExits();
  const updateExit = useUpdateExit();
  const completeExit = useCompleteExit();
  const toggleTask = useToggleExitTask();
  const addTask = useAddExitTask();

  const [approving, setApproving] = useState<EmployeeExit | null>(null);
  const [approveDate, setApproveDate] = useState("");
  const [declining, setDeclining] = useState<EmployeeExit | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [changingDate, setChangingDate] = useState<EmployeeExit | null>(null);
  const [newDate, setNewDate] = useState("");
  const [cancelling, setCancelling] = useState<EmployeeExit | null>(null);
  const [completing, setCompleting] = useState<EmployeeExit | null>(null);
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const requested = exits.filter((x) => x.status === "requested");
  const leaving = exits.filter((x) => x.status === "in_progress");
  const left = exits
    .filter((x) => x.status === "completed")
    .sort((a, b) => b.last_working_day.localeCompare(a.last_working_day));

  const fail = (title: string) => (error: Error) => toast.error(title, { description: error.message });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {requested.length > 0 && (
        <section aria-labelledby="resignations-heading" className="space-y-3">
          <h2 id="resignations-heading" className="text-sm font-semibold text-muted-foreground">
            Resignations to review
          </h2>
          <ul className="space-y-3">
            {requested.map((exit) => (
              <li key={exit.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                    <PersonHeader exit={exit} />
                    <div className="space-y-1 text-sm md:w-64">
                      <p className="text-muted-foreground">Resigned {fmt(exit.created_at.slice(0, 10))}</p>
                      <p className="font-medium text-foreground">Proposed last day: {fmt(exit.last_working_day)}</p>
                      {exit.notes && <p className="line-clamp-2 text-muted-foreground">“{exit.notes}”</p>}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button
                          size="sm"
                          className="h-10 sm:h-9"
                          onClick={() => {
                            setApproving(exit);
                            setApproveDate(exit.last_working_day);
                          }}
                        >
                          <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 sm:h-9"
                          onClick={() => {
                            setDeclining(exit);
                            setDeclineNote("");
                          }}
                        >
                          <X className="mr-2 h-4 w-4" aria-hidden="true" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="leaving-heading" className="space-y-3">
        <h2 id="leaving-heading" className="text-sm font-semibold text-muted-foreground">
          Leaving
        </h2>
        {leaving.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <DoorOpen className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Nobody is leaving</p>
                <p className="text-sm text-muted-foreground">
                  {canManage ? (
                    <>
                      Start an offboarding from someone's row in{" "}
                      <Link to="/employees" className="font-medium text-primary underline-offset-4 hover:underline">
                        Employees
                      </Link>
                      . Resignations appear here for approval.
                    </>
                  ) : (
                    "People with an offboarding in progress appear here."
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {leaving.map((exit) => {
              const done = exit.tasks.filter((t) => t.done_at).length;
              const total = exit.tasks.length;
              const due = lastDayText(exit.last_working_day);
              const canComplete = differenceInCalendarDays(parseISO(exit.last_working_day), new Date()) <= 0;
              const isOpen = open[exit.id] ?? false;
              return (
                <li key={exit.id} data-leaving>
                  <Card>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <PersonHeader exit={exit} />
                        <div className="space-y-1 md:w-64">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            Last day {fmt(exit.last_working_day)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={toneClass(due.tone)}>
                              {due.text}
                            </Badge>
                            <Badge variant="outline" className={toneClass("neutral")}>
                              {exitReasonLabel(exit.reason)}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-1.5 md:w-44">
                          <p className="text-sm text-muted-foreground">
                            Checklist{" "}
                            <span className="font-medium tabular-nums text-foreground">
                              {done} of {total}
                            </span>
                          </p>
                          <Progress
                            value={total ? (done / total) * 100 : 0}
                            className="h-2"
                            aria-label={`${done} of ${total} checklist items done`}
                          />
                        </div>
                      </div>

                      <Collapsible open={isOpen} onOpenChange={(o) => setOpen((s) => ({ ...s, [exit.id]: o }))}>
                        <div className="flex flex-wrap items-center gap-2">
                          <CollapsibleTrigger asChild>
                            <Button size="sm" variant="outline" className="h-10 sm:h-9" aria-expanded={isOpen}>
                              <ChevronDown
                                className={cn("mr-2 h-4 w-4 transition-transform", isOpen && "rotate-180")}
                                aria-hidden="true"
                              />
                              {isOpen ? "Hide checklist" : "Show checklist"}
                            </Button>
                          </CollapsibleTrigger>
                          {canManage && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 sm:h-9"
                                onClick={() => {
                                  setChangingDate(exit);
                                  setNewDate(exit.last_working_day);
                                }}
                              >
                                <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
                                Change last day
                              </Button>
                              {canComplete && (
                                <Button size="sm" className="h-10 sm:h-9" onClick={() => setCompleting(exit)}>
                                  <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Complete now
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-10 text-red-700 hover:bg-red-50 hover:text-red-800 sm:h-9"
                                onClick={() => setCancelling(exit)}
                              >
                                <X className="mr-2 h-4 w-4" aria-hidden="true" />
                                Cancel offboarding
                              </Button>
                            </>
                          )}
                        </div>
                        <CollapsibleContent className="pt-4">
                          <ul className="divide-y rounded-lg border" aria-label={`Checklist for ${nameOf(exit)}`}>
                            {exit.tasks.map((task) => (
                              <li key={task.id} className="flex items-start gap-3 p-3">
                                <Checkbox
                                  id={`task-${task.id}`}
                                  checked={!!task.done_at}
                                  disabled={!canManage || (toggleTask.isPending && toggleTask.variables?.id === task.id)}
                                  onCheckedChange={(checked) =>
                                    toggleTask.mutate(
                                      { id: task.id, done: checked === true },
                                      { onError: fail("Couldn't update the checklist") },
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <label htmlFor={`task-${task.id}`} className="min-w-0 flex-1 text-sm">
                                  <span className={cn("text-foreground", task.done_at && "text-muted-foreground line-through")}>
                                    {task.title}
                                  </span>
                                  {task.category === "asset" && !task.done_at && (
                                    <span className="block text-xs text-muted-foreground">
                                      Ticks itself when the asset is marked returned in Assets
                                    </span>
                                  )}
                                </label>
                              </li>
                            ))}
                            {exit.tasks.length === 0 && (
                              <li className="p-3 text-sm text-muted-foreground">No checklist items.</li>
                            )}
                          </ul>
                          {canManage && (
                            <form
                              className="mt-3 flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const title = (newTask[exit.id] ?? "").trim();
                                if (!title) return;
                                addTask.mutate(
                                  { exitId: exit.id, title },
                                  {
                                    onSuccess: () => setNewTask((s) => ({ ...s, [exit.id]: "" })),
                                    onError: fail("Couldn't add the item"),
                                  },
                                );
                              }}
                            >
                              <Label htmlFor={`new-task-${exit.id}`} className="sr-only">
                                New checklist item
                              </Label>
                              <Input
                                id={`new-task-${exit.id}`}
                                value={newTask[exit.id] ?? ""}
                                onChange={(e) => setNewTask((s) => ({ ...s, [exit.id]: e.target.value }))}
                                placeholder="Add an item, e.g. Revoke Slack access"
                                maxLength={200}
                              />
                              <Button type="submit" variant="outline" disabled={addTask.isPending} aria-label="Add item">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                <span className="ml-2 hidden sm:inline">Add</span>
                              </Button>
                            </form>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {left.length > 0 && (
        <section aria-labelledby="left-heading">
          <h2 id="left-heading" className="mb-3 text-sm font-semibold text-muted-foreground">
            Left in the last 90 days
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {left.map((exit) => (
              <li key={exit.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <DoorOpen className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{nameOf(exit)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {exitReasonLabel(exit.reason)} · last day {fmt(exit.last_working_day)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Approve resignation */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve {approving ? nameOf(approving) : ""}'s resignation</DialogTitle>
            <DialogDescription>
              Confirm the last working day. The offboarding checklist is created and they're told the date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-last-day">Last working day</Label>
            <Input
              id="approve-last-day"
              type="date"
              value={approveDate}
              min={approving?.notice_date}
              onChange={(e) => setApproveDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!approveDate || updateExit.isPending}
              onClick={() =>
                approving &&
                updateExit.mutate(
                  { id: approving.id, status: "in_progress", lastWorkingDay: approveDate },
                  {
                    onSuccess: () => {
                      toast.success(`Resignation approved`, { description: `Last working day: ${fmt(approveDate)}.` });
                      setApproving(null);
                    },
                    onError: fail("Couldn't approve the resignation"),
                  },
                )
              }
            >
              {updateExit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline resignation */}
      <Dialog open={!!declining} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline {declining ? nameOf(declining) : ""}'s resignation?</DialogTitle>
            <DialogDescription>They stay on as they are. Your note is shown to them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-note">Note to {declining?.employee?.first_name ?? "them"}</Label>
            <Textarea
              id="decline-note"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="e.g. Let's talk on Monday"
              maxLength={2000}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={updateExit.isPending}
              onClick={() =>
                declining &&
                updateExit.mutate(
                  { id: declining.id, status: "declined", decisionNotes: declineNote },
                  {
                    onSuccess: () => {
                      toast.success("Resignation declined");
                      setDeclining(null);
                    },
                    onError: fail("Couldn't decline the resignation"),
                  },
                )
              }
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change last working day */}
      <Dialog open={!!changingDate} onOpenChange={(o) => !o && setChangingDate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change {changingDate ? nameOf(changingDate) : ""}'s last day</DialogTitle>
            <DialogDescription>Payroll for their final month is prorated to this date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="change-last-day">Last working day</Label>
            <Input
              id="change-last-day"
              type="date"
              value={newDate}
              min={changingDate?.notice_date}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangingDate(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newDate || updateExit.isPending}
              onClick={() =>
                changingDate &&
                updateExit.mutate(
                  { id: changingDate.id, lastWorkingDay: newDate },
                  {
                    onSuccess: () => {
                      toast.success("Last working day updated", { description: fmt(newDate) });
                      setChangingDate(null);
                    },
                    onError: fail("Couldn't change the date"),
                  },
                )
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel offboarding */}
      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelling ? nameOf(cancelling) : ""}'s offboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              They stay on as an active employee and their checklist is closed. They're notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep offboarding</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                cancelling &&
                updateExit.mutate(
                  { id: cancelling.id, status: "cancelled" },
                  {
                    onSuccess: () => toast.success("Offboarding cancelled"),
                    onError: fail("Couldn't cancel the offboarding"),
                  },
                )
              }
            >
              Cancel offboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete now */}
      <AlertDialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {completing ? nameOf(completing) : ""}'s offboarding now?</AlertDialogTitle>
            <AlertDialogDescription>
              They're marked as offboarded, their sign-in is blocked and pending leave is cancelled. This otherwise
              happens automatically the morning after their last working day.
              {completing && completing.tasks.some((t) => !t.done_at) && (
                <span className="mt-2 block font-medium text-foreground">
                  {completing.tasks.filter((t) => !t.done_at).length} checklist item(s) are still open.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                completing &&
                completeExit.mutate(completing.id, {
                  onSuccess: () => toast.success(`${nameOf(completing)} has been offboarded`),
                  onError: fail("Couldn't complete the offboarding"),
                })
              }
            >
              Complete offboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
