import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2, PackageCheck, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { issueKindLabel, useCloseAssetIssue, type Asset, type AssetIssue } from "@/hooks/useAssets";
import { statusBadgeClass } from "@/lib/statusStyles";

interface AssetIssuesPanelProps {
  issues: AssetIssue[];
  isLoading: boolean;
  assets: Asset[];
  canManage: boolean;
  /** Open the Send for repair dialog for this asset, linked to the problem */
  onSendForRepair: (asset: Asset, issue: AssetIssue) => void;
}

/** Problems employees reported with their assets, for people who manage assets. */
export function AssetIssuesPanel({ issues, isLoading, assets, canManage, onSendForRepair }: AssetIssuesPanelProps) {
  const closeIssue = useCloseAssetIssue();
  const [closing, setClosing] = useState<{ issue: AssetIssue; status: "resolved" | "dismissed" } | null>(null);
  const [notes, setNotes] = useState("");

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <PackageCheck className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-foreground">No open problems</h3>
          <p className="text-muted-foreground">When someone reports a problem with their asset, it shows up here.</p>
        </CardContent>
      </Card>
    );
  }

  const submitClose = () => {
    if (!closing) return;
    closeIssue.mutate(
      { issueId: closing.issue.id, status: closing.status, notes },
      {
        onSuccess: () => {
          toast.success(closing.status === "resolved" ? "Marked as resolved" : "Dismissed", {
            description: "The person who reported it has been notified.",
          });
          setClosing(null);
          setNotes("");
        },
        onError: (error: Error) => toast.error("Couldn't update the problem", { description: error.message }),
      },
    );
  };

  return (
    <>
      <ul className="space-y-3">
        {issues.map((issue) => {
          const asset = assets.find((a) => a.id === issue.assetId);
          const canRepair = canManage && asset && issue.status === "open" && ["available", "assigned", "damaged"].includes(asset.status);
          return (
            <li key={issue.id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {issue.assetName} <span className="text-sm font-normal text-muted-foreground">{issue.assetCode}</span>
                    </p>
                    <Badge variant="outline" className={statusBadgeClass(issue.status === "open" ? "pending" : "in_progress")}>
                      {issue.status === "open" ? "Open" : "In repair"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {issueKindLabel(issue.kind)} · reported by {issue.reportedBy ?? "HR"} on{" "}
                    {format(parseISO(issue.createdAt), "MMM d, yyyy")}
                  </p>
                  <p className="break-words text-sm text-foreground">{issue.description}</p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canRepair && (
                      <Button size="sm" variant="outline" onClick={() => onSendForRepair(asset, issue)}>
                        <Wrench className="mr-2 h-4 w-4" aria-hidden="true" />
                        Send for repair
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setClosing({ issue, status: "resolved" })}>
                      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Resolved
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClosing({ issue, status: "dismissed" })}>
                      <X className="mr-2 h-4 w-4" aria-hidden="true" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!closing} onOpenChange={(open) => !open && (setClosing(null), setNotes(""))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{closing?.status === "resolved" ? "Mark as resolved" : "Dismiss this problem"}</DialogTitle>
            <DialogDescription>
              {closing?.issue.assetName}: {closing?.issue.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="issue-close-notes">Note to {closing?.issue.reportedBy ?? "the employee"}</Label>
            <Textarea
              id="issue-close-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={closing?.status === "resolved" ? "e.g. Replaced the charger" : "e.g. Working as expected after a restart"}
              maxLength={2000}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setClosing(null), setNotes(""))}>
              Cancel
            </Button>
            <Button onClick={submitClose} disabled={closeIssue.isPending}>
              {closeIssue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {closing?.status === "resolved" ? "Mark resolved" : "Dismiss"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
