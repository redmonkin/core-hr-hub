import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass } from "@/lib/statusStyles";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Package, Calendar, Tag, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_KINDS, issueKindLabel, useMyAssetIssues, useReportAssetIssue } from "@/hooks/useAssets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface MyAssetsProps {
  employeeId: string;
}

interface AssetAssignment {
  id: string;
  assigned_date: string;
  returned_date: string | null;
  notes: string | null;
  asset: {
    id: string;
    name: string;
    asset_code: string;
    category: string;
    serial_number: string | null;
  } | null;
}

export function MyAssets({ employeeId }: MyAssetsProps) {
  const { data: myIssues = [] } = useMyAssetIssues(employeeId);
  const reportIssue = useReportAssetIssue();
  const [reporting, setReporting] = useState<{ id: string; name: string } | null>(null);
  const [kind, setKind] = useState<string>("not_working");
  const [description, setDescription] = useState("");
  const openIssueFor = (assetId: string) => myIssues.find((i) => i.assetId === assetId && (i.status === "open" || i.status === "in_repair"));

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporting || !description.trim()) return;
    reportIssue.mutate(
      { assetId: reporting.id, kind, description: description.trim() },
      {
        onSuccess: () => {
          toast.success("Problem reported", { description: "HR has been notified and will get back to you." });
          setReporting(null);
        },
        onError: (error: Error) => toast.error("Couldn't report the problem", { description: error.message }),
      },
    );
  };

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assets", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          assigned_date,
          returned_date,
          notes,
          asset:assets!asset_assignments_asset_id_fkey (
            id,
            name,
            asset_code,
            category,
            serial_number
          )
        `)
        .eq("employee_id", employeeId)
        .order("assigned_date", { ascending: false });

      if (error) throw error;
      return data as AssetAssignment[];
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden="true" />
            My assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentAssets = assignments?.filter((a) => !a.returned_date) || [];
  const returnedAssets = assignments?.filter((a) => a.returned_date) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden="true" />
            Currently assigned assets
          </CardTitle>
          <CardDescription>Assets currently in your possession</CardDescription>
        </CardHeader>
        <CardContent>
          {currentAssets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {currentAssets.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{assignment.asset?.name || "Unknown asset"}</h4>
                      <p className="text-sm text-muted-foreground">{assignment.asset?.asset_code}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs capitalize">
                      {assignment.asset?.category}
                    </Badge>
                  </div>
                  {assignment.asset?.serial_number && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>S/N: {assignment.asset.serial_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Assigned: {format(new Date(assignment.assigned_date), "MMM d, yyyy")}</span>
                  </div>
                  {assignment.notes && (
                    <p className="text-xs text-muted-foreground italic">{assignment.notes}</p>
                  )}
                  {assignment.asset && (() => {
                    const open = openIssueFor(assignment.asset.id);
                    return open ? (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Problem reported{open.status === "in_repair" ? " · in repair" : " · HR will be in touch"}
                      </p>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setReporting({ id: assignment.asset!.id, name: assignment.asset!.name });
                          setKind("not_working");
                          setDescription("");
                        }}
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Report a problem
                      </Button>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No assets currently assigned</p>
            </div>
          )}
        </CardContent>
      </Card>

      {myIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Problems you've reported</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {myIssues.map((issue) => (
                <li key={issue.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{issue.assetName}</span>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(
                        issue.status === "open" ? "pending" : issue.status === "in_repair" ? "in_progress" : issue.status === "resolved" ? "completed" : "cancelled",
                      )}
                    >
                      {issue.status === "open" ? "Open" : issue.status === "in_repair" ? "In repair" : issue.status === "resolved" ? "Resolved" : "Closed"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {issueKindLabel(issue.kind)} · {format(new Date(issue.createdAt), "MMM d, yyyy")}
                  </p>
                  <p className="mt-1 break-words">{issue.description}</p>
                  {issue.resolutionNotes && <p className="mt-1 text-muted-foreground">HR: {issue.resolutionNotes}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!reporting} onOpenChange={(open) => !open && setReporting(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitReport} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Report a problem: {reporting?.name}</DialogTitle>
              <DialogDescription>HR is notified and will arrange a repair or replacement.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="issue-kind">What's the problem?</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="issue-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-description">Tell us what happened *</Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. The screen flickers and goes black after a few minutes"
                maxLength={2000}
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReporting(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!description.trim() || reportIssue.isPending}>
                {reportIssue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Report problem
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {returnedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previously assigned assets</CardTitle>
            <CardDescription>Assets you have returned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {returnedAssets.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-dashed p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{assignment.asset?.name || "Unknown asset"}</h4>
                      <p className="text-sm text-muted-foreground">{assignment.asset?.asset_code}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${statusBadgeClass("returned")}`}>
                      Returned
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Returned: {format(new Date(assignment.returned_date!), "MMM d, yyyy")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
