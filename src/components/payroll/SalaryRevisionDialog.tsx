import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  useCreateSalaryRevision,
  useIsOwnEmployee,
  useReviewsForRevision,
  useSalaryRevisionApproval,
} from "@/hooks/useSalaryRevisions";
import { formatCurrency } from "@/lib/currency";
import {
  COMPONENT_FIELDS,
  REVISION_TYPES,
  applyIncrement,
  formatPercent,
  grossOf,
  netOf,
  percentChange,
  sameComponents,
  toComponents,
  type SalaryComponents,
  type SalaryRevisionType,
} from "@/lib/salaryRevision";

interface SalaryRevisionDialogProps {
  /** The person whose pay is being revised; null closes the dialog. */
  employee: { id: string; name: string } | null;
  current: SalaryComponents | null;
  onOpenChange: (open: boolean) => void;
}

type Draft = Record<keyof SalaryComponents, string>;

const toDraft = (c: SalaryComponents): Draft =>
  Object.fromEntries(COMPONENT_FIELDS.map(({ key }) => [key, String(c[key])])) as Draft;

const firstOfNextMonth = () => format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd");
const today = () => format(new Date(), "yyyy-MM-dd");

export function SalaryRevisionDialog({ employee, current, onOpenChange }: SalaryRevisionDialogProps) {
  const create = useCreateSalaryRevision();
  const { data: approvalRequired = false } = useSalaryRevisionApproval();
  const { data: reviews = [] } = useReviewsForRevision(employee?.id, !!employee);
  const isOwn = useIsOwnEmployee(employee?.id);

  const [type, setType] = useState<SalaryRevisionType>("annual_appraisal");
  const [effectiveFrom, setEffectiveFrom] = useState(firstOfNextMonth());
  const [increment, setIncrement] = useState("");
  const [draft, setDraft] = useState<Draft>(() => toDraft(toComponents(current)));
  const [reviewId, setReviewId] = useState<string>("none");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!employee) return;
    setType("annual_appraisal");
    setEffectiveFrom(firstOfNextMonth());
    setIncrement("");
    setDraft(toDraft(toComponents(current)));
    setReviewId("none");
    setReason("");
    setNotify(true);
    // Reset only when a different person is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const before = useMemo(() => toComponents(current), [current]);
  const after = useMemo(() => toComponents(draft), [draft]);
  const oldGross = grossOf(before);
  const newGross = grossOf(after);
  const change = percentChange(oldGross, newGross);
  const unchanged = sameComponents(before, after);
  const invalidAmount = COMPONENT_FIELDS.some(({ key }) => draft[key] !== "" && !(Number(draft[key]) >= 0));
  const missingBasic = !(after.basic_salary > 0);
  const isFuture = !!effectiveFrom && effectiveFrom > today();
  const isBackdated = !!effectiveFrom && effectiveFrom < today();
  const firstName = employee?.name.split(" ")[0] ?? "";

  const applyPercent = () => {
    const pct = Number(increment);
    if (!increment || !Number.isFinite(pct)) return;
    setDraft(toDraft(applyIncrement(before, pct)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Rendered in a portal, but React still bubbles submit to a parent form (Edit employee)
    e.stopPropagation();
    if (!employee || !effectiveFrom || unchanged || invalidAmount || missingBasic) return;
    create.mutate(
      {
        employeeId: employee.id,
        revisionType: type,
        effectiveFrom,
        reason,
        performanceReviewId: reviewId === "none" ? null : reviewId,
        components: after,
        notifyEmployee: notify,
      },
      {
        onSuccess: ({ revision, emailError }) => {
          const date = format(parseISO(effectiveFrom), "MMM d, yyyy");
          if (revision?.status === "pending_approval") {
            toast.success(`Revision for ${employee.name} sent for approval`, {
              description: "Another payroll admin has to approve it before it takes effect.",
            });
          } else if (revision?.status === "applied") {
            const adjustment = revision.adjustmentAmount;
            toast.success(`${employee.name}'s salary is revised`, {
              description:
                adjustment > 0
                  ? `Arrears of ${formatCurrency(adjustment)} will be added to the next payroll.`
                  : adjustment < 0
                    ? `This month's payroll will be prorated (${formatCurrency(adjustment)}).`
                    : `Effective ${date}.`,
            });
          } else {
            toast.success(`Revision for ${employee.name} scheduled`, {
              description: `It takes effect automatically on ${date}.`,
            });
          }
          if (emailError) toast.warning(emailError);
          onOpenChange(false);
        },
        onError: (error: Error) => toast.error("Couldn't save the revision", { description: error.message }),
      },
    );
  };

  const amountField = (key: keyof SalaryComponents, label: string) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={`revise-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`revise-${key}`}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={draft[key]}
        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
        aria-describedby={`revise-${key}-current`}
      />
      <p id={`revise-${key}-current`} className="text-xs text-muted-foreground">
        Now {formatCurrency(before[key])}
      </p>
    </div>
  );

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Revise salary for {employee?.name}</DialogTitle>
            <DialogDescription>
              Monthly amounts. The current salary stays on record, and payroll uses the new one from the effective
              date.
            </DialogDescription>
          </DialogHeader>

          {isOwn && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              This is your own salary. As an admin you can revise it; the change is recorded with your name.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="revise-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as SalaryRevisionType)}>
                <SelectTrigger id="revise-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVISION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revise-effective">Effective from *</Label>
              <Input
                id="revise-effective"
                type="date"
                className="block w-full min-w-0"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
          </div>
          {(isFuture || isBackdated) && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {isFuture
                ? approvalRequired
                  ? "Once approved, it's applied automatically on that date."
                  : "It's applied automatically on that date."
                : "Backdated: arrears for months already in payroll are added to the next payroll and shown on the payslip."}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="revise-increment">Increase every earning by</Label>
            <div className="flex gap-2">
              <div className="relative w-32">
                <Input
                  id="revise-increment"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={increment}
                  onChange={(e) => setIncrement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPercent();
                    }
                  }}
                  className="pr-7"
                  placeholder="10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <Button type="button" variant="outline" onClick={applyPercent} disabled={!increment}>
                Apply
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Optional. Fills in the amounts below; you can still edit each one.</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground">Earnings</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {COMPONENT_FIELDS.filter((f) => f.kind === "earning").map((f) =>
                amountField(f.key, f.key === "basic_salary" ? "Basic salary *" : f.label),
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground">Deductions</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {COMPONENT_FIELDS.filter((f) => f.kind === "deduction").map((f) => amountField(f.key, f.label))}
            </div>
          </fieldset>

          <div className="rounded-lg bg-primary/10 p-4 text-sm" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Monthly gross</span>
              <span className="flex items-center gap-2 font-medium text-foreground">
                {formatCurrency(oldGross)}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="to" />
                {formatCurrency(newGross)}
                <span
                  className={
                    change === null || change === 0
                      ? "text-muted-foreground"
                      : change > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-destructive"
                  }
                >
                  ({formatPercent(change)})
                </span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Net take-home</span>
              <span className="font-semibold text-foreground">{formatCurrency(netOf(after))}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Annual gross</span>
              <span className="text-foreground">{formatCurrency(newGross * 12)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revise-review">Linked performance review</Label>
            <Select value={reviewId} onValueChange={setReviewId}>
              <SelectTrigger id="revise-review">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {reviews.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.review_period}
                    {r.overall_rating ? ` · rated ${r.overall_rating}/5` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revise-reason">Reason</Label>
            <Textarea
              id="revise-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For payroll records (optional). Not shown to the employee."
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox id="revise-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
            <div className="space-y-0.5">
              <Label htmlFor="revise-notify" className="font-normal">
                Email {firstName || "the employee"} when it takes effect
              </Label>
              <p className="text-xs text-muted-foreground">
                The revision letter is in their profile either way.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!effectiveFrom || unchanged || invalidAmount || missingBasic || create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {approvalRequired ? "Submit for approval" : isFuture ? "Schedule revision" : "Revise salary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
