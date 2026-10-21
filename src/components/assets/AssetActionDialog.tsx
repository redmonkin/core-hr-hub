import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RETIRE_REASONS,
  useCompleteRepair,
  useRetireAsset,
  useSendForRepair,
  useSetAssetCondition,
  type Asset,
  type AssetIssue,
} from "@/hooks/useAssets";
import { formatCurrency } from "@/lib/currency";

/** Actions that need a dialog (assign, edit, history and delete live on the page). */
export type AssetDialogAction = "repair" | "complete-repair" | "damaged" | "lost" | "found" | "back-in-use" | "retire";

interface AssetActionDialogProps {
  asset: Asset | null;
  action: AssetDialogAction | null;
  /** Set when sending an asset for repair from a reported problem */
  issue?: AssetIssue | null;
  onClose: () => void;
}

const today = () => format(new Date(), "yyyy-MM-dd");
const toNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));

const COPY: Record<AssetDialogAction, { title: string; description: string; button: string }> = {
  repair: {
    title: "Send for repair",
    description: "It shows as In repair until you mark it back. Whoever has it keeps it assigned.",
    button: "Send for repair",
  },
  "complete-repair": {
    title: "Back from repair",
    description: "Record what it cost. A repaired asset goes back to whoever had it, or becomes available.",
    button: "Save",
  },
  damaged: {
    title: "Mark as damaged",
    description: "It stays with whoever has it until you send it for repair or retire it.",
    button: "Mark as damaged",
  },
  lost: {
    title: "Mark as lost",
    description: "It's taken off the person who had it. If it turns up, use Found it.",
    button: "Mark as lost",
  },
  found: {
    title: "Found it",
    description: "It becomes available again.",
    button: "Mark as found",
  },
  "back-in-use": {
    title: "Back in use",
    description: "For damage that was sorted without a repair. It goes back to whoever has it, or becomes available.",
    button: "Put back in use",
  },
  retire: {
    title: "Retire asset",
    description: "Retired assets leave the active inventory but keep their history. It's taken off whoever has it.",
    button: "Retire asset",
  },
};

export function AssetActionDialog({ asset, action, issue, onClose }: AssetActionDialogProps) {
  const sendForRepair = useSendForRepair();
  const completeRepair = useCompleteRepair();
  const setCondition = useSetAssetCondition();
  const retire = useRetireAsset();

  const [problem, setProblem] = useState("");
  const [vendor, setVendor] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [cost, setCost] = useState("");
  const [outcome, setOutcome] = useState<"repaired" | "beyond_repair">("repaired");
  const [reason, setReason] = useState("");
  const [retireReason, setRetireReason] = useState<string>("end_of_life");
  const [retiredOn, setRetiredOn] = useState(today());

  useEffect(() => {
    if (!asset || !action) return;
    setProblem(issue ? issue.description : "");
    setVendor("");
    setExpectedReturn("");
    setCost(action === "complete-repair" && asset.openRepair?.estimatedCost != null ? String(asset.openRepair.estimatedCost) : "");
    setOutcome("repaired");
    setReason("");
    setRetireReason(asset.status === "lost" ? "lost" : asset.status === "damaged" ? "beyond_repair" : "end_of_life");
    setRetiredOn(today());
  }, [asset, action, issue]);

  if (!asset || !action) return null;
  const copy = COPY[action];
  const pending = sendForRepair.isPending || completeRepair.isPending || setCondition.isPending || retire.isPending;
  const costInvalid = cost.trim() !== "" && !(Number(cost) >= 0);
  const needsReason = action === "damaged" || action === "lost" || action === "found" || action === "back-in-use";
  const disabled =
    pending ||
    costInvalid ||
    (action === "repair" && !problem.trim()) ||
    (needsReason && !reason.trim());

  const done = (message: string) => {
    toast.success(message);
    onClose();
  };
  const failed = (error: Error) => toast.error("Couldn't update the asset", { description: error.message });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const callbacks = { onError: failed };
    switch (action) {
      case "repair":
        sendForRepair.mutate(
          {
            assetId: asset.id,
            problem: problem.trim(),
            vendor: vendor.trim(),
            expectedReturn,
            estimatedCost: toNumber(cost),
            issueId: issue?.id,
          },
          { ...callbacks, onSuccess: () => done(`${asset.name} sent for repair`) },
        );
        break;
      case "complete-repair":
        if (!asset.openRepair) return;
        completeRepair.mutate(
          { repairId: asset.openRepair.id, outcome, actualCost: toNumber(cost), notes: reason.trim() },
          {
            ...callbacks,
            onSuccess: () =>
              done(outcome === "repaired" ? `${asset.name} is back from repair` : `${asset.name} marked beyond repair`),
          },
        );
        break;
      case "retire":
        retire.mutate(
          { assetId: asset.id, reason: retireReason, notes: reason.trim(), retiredOn, disposalValue: toNumber(cost) },
          { ...callbacks, onSuccess: () => done(`${asset.name} retired`) },
        );
        break;
      default:
        setCondition.mutate(
          {
            assetId: asset.id,
            status: action === "damaged" ? "damaged" : action === "lost" ? "lost" : "available",
            reason: reason.trim(),
          },
          { ...callbacks, onSuccess: () => done(`${asset.name} updated`) },
        );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {copy.title}: {asset.name}
            </DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {action === "repair" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="repair-problem">What's wrong *</Label>
                <Textarea
                  id="repair-problem"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="e.g. Screen flickers, battery drains in an hour"
                  maxLength={2000}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repair-vendor">Repair vendor</Label>
                <Input id="repair-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Apple Service Centre" maxLength={200} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="repair-expected">Expected back</Label>
                  <Input
                    id="repair-expected"
                    type="date"
                    className="block w-full min-w-0"
                    min={today()}
                    value={expectedReturn}
                    onChange={(e) => setExpectedReturn(e.target.value)}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="repair-estimate">Estimated cost (₹)</Label>
                  <Input id="repair-estimate" type="number" inputMode="decimal" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
                </div>
              </div>
            </>
          )}

          {action === "complete-repair" && (
            <>
              {asset.openRepair && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-foreground">{asset.openRepair.problem}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {format(parseISO(asset.openRepair.sentDate), "MMM d, yyyy")}
                    {asset.openRepair.vendor && ` to ${asset.openRepair.vendor}`}
                    {asset.openRepair.estimatedCost != null && ` · estimate ${formatCurrency(asset.openRepair.estimatedCost)}`}
                  </p>
                </div>
              )}
              <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)} className="gap-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="repaired" id="outcome-repaired" />
                  <Label htmlFor="outcome-repaired" className="font-normal">Repaired, ready to use</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="beyond_repair" id="outcome-beyond" />
                  <Label htmlFor="outcome-beyond" className="font-normal">Beyond repair (marks it damaged)</Label>
                </div>
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="repair-actual">Actual cost (₹)</Label>
                <Input id="repair-actual" type="number" inputMode="decimal" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
                <p className="text-xs text-muted-foreground">Repair costs are totalled in Reports.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repair-notes">Notes</Label>
                <Textarea id="repair-notes" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Battery replaced" maxLength={2000} rows={2} />
              </div>
            </>
          )}

          {needsReason && (
            <div className="space-y-2">
              <Label htmlFor="asset-reason">
                {action === "found" ? "Where was it found? *" : action === "back-in-use" ? "What was done? *" : "What happened? *"}
              </Label>
              <Textarea
                id="asset-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === "damaged"
                    ? "e.g. Dropped, screen cracked"
                    : action === "lost"
                      ? "e.g. Left in a cab on 12 Oct, reported by the employee"
                      : action === "found"
                        ? "e.g. Returned by the cab company"
                        : "e.g. Replaced the charger"
                }
                maxLength={2000}
                rows={3}
                required
              />
            </div>
          )}

          {action === "retire" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="retire-reason">Reason *</Label>
                <Select value={retireReason} onValueChange={setRetireReason}>
                  <SelectTrigger id="retire-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETIRE_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="retire-date">Retired on</Label>
                  <Input id="retire-date" type="date" className="block w-full min-w-0" value={retiredOn} onChange={(e) => setRetiredOn(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="retire-value">Amount recovered (₹)</Label>
                  <Input id="retire-value" type="number" inputMode="decimal" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. sale price" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="retire-notes">Notes</Label>
                <Textarea id="retire-notes" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sold to the employee" maxLength={2000} rows={2} />
              </div>
            </>
          )}

          {costInvalid && <p className="text-xs text-destructive">Enter an amount of 0 or more.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled} variant={action === "lost" || action === "retire" || action === "damaged" ? "destructive" : "default"}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {copy.button}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
