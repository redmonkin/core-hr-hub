import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ASSET_STATUS_LABELS, useAssetEvents, useAssetHistory, type Asset } from "@/hooks/useAssets";
import { formatCurrency } from "@/lib/currency";

const EVENT_LABELS: Record<string, string> = {
  created: "Added to inventory",
  assigned: "Assigned",
  returned: "Returned",
  sent_for_repair: "Sent for repair",
  repaired: "Back from repair",
  beyond_repair: "Beyond repair",
  marked_damaged: "Marked damaged",
  marked_lost: "Marked lost",
  found: "Found",
  back_in_use: "Back in use",
  retired: "Retired",
  issue_reported: "Problem reported",
  status_changed: "Status changed",
};

const AMOUNT_LABELS: Record<string, string> = {
  sent_for_repair: "Estimate",
  repaired: "Cost",
  beyond_repair: "Cost",
  retired: "Recovered",
};

interface AssetHistoryDialogProps {
  asset: Asset | null;
  onClose: () => void;
}

export function AssetHistoryDialog({ asset, onClose }: AssetHistoryDialogProps) {
  const { data: events = [], isLoading } = useAssetEvents(asset?.id ?? null);
  const { data: assignments = [] } = useAssetHistory(asset?.id ?? null);

  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>History: {asset?.name}</DialogTitle>
          <DialogDescription>
            {asset?.assetCode}
            {asset && asset.repairCount > 0 &&
              ` · ${asset.repairCount} ${asset.repairCount === 1 ? "repair" : "repairs"}, ${formatCurrency(asset.repairSpend)} spent`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  {EVENT_LABELS[e.event] ?? "Updated"}
                  {e.event === "status_changed" && e.toStatus && ` to ${ASSET_STATUS_LABELS[e.toStatus]}`}
                  {e.employeeName && (e.event === "assigned" || e.event === "returned" || e.event === "issue_reported")
                    ? ` · ${e.employeeName}`
                    : ""}
                </p>
                {e.reason && <p className="break-words text-sm text-muted-foreground">{e.reason}</p>}
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(e.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  {e.amount != null && ` · ${AMOUNT_LABELS[e.event] ?? "Amount"} ${formatCurrency(e.amount)}`}
                </p>
              </li>
            ))}
          </ol>
        )}

        {assignments.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Who has had it</h4>
            <ul className="divide-y rounded-lg border text-sm">
              {assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
                  <span className="text-foreground">{a.employee.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.assignedDate} – {a.returnedDate ?? "now"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
