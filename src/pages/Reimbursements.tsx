import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReimbursementCard } from "@/components/reimbursements/ReimbursementCard";
import { ReimbursementRequestForm } from "@/components/reimbursements/ReimbursementRequestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Receipt, Plus, Clock, CheckCircle, XCircle, Banknote, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useReimbursementRequests,
  useReimbursementStats,
  useUpdateReimbursementStatus,
  useBulkUpdateReimbursementStatus,
  ReimbursementRequest,
} from "@/hooks/useReimbursements";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency } from "@/lib/currency";

const Reimbursements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const { can, roles } = usePermissions();

  const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | "paid" | null>(null);

  // Bulk actions: claims ticked on the current tab
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | "paid" | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");

  // Managers approve their reports (RLS limits them to their team);
  // reimbursements:manage approves anyone's and marks claims paid
  const canApprove = can("reimbursements", "manage") || roles.includes("manager");
  const canSeeOthersRequests = canApprove || can("reimbursements", "view");
  const canMarkPaid = can("reimbursements", "manage");

  const { data: myEmployeeId, isLoading: isLoadingMyEmployee } = useQuery({
    queryKey: ["my-employee-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: requests = [], isLoading } = useReimbursementRequests();
  const { data: stats } = useReimbursementStats();
  const updateStatusMutation = useUpdateReimbursementStatus();
  const bulkUpdateMutation = useBulkUpdateReimbursementStatus();

  const getDocumentUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("reimbursement-receipts")
      .createSignedUrl(filePath, 3600);

    if (error) {
      toast({ title: "Error", description: "Failed to get receipt URL", variant: "destructive" });
      return null;
    }
    return data.signedUrl;
  };

  const handleViewReceipt = async (filePath: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) window.open(url, "_blank");
  };

  const handleApprove = (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (request) {
      setSelectedRequest(request);
      setActionType("approve");
      setReviewNotes("");
    }
  };

  const handleReject = (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (request) {
      setSelectedRequest(request);
      setActionType("reject");
      setReviewNotes("");
    }
  };

  const handleMarkPaid = (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (request) {
      setSelectedRequest(request);
      setActionType("paid");
      setReviewNotes("");
    }
  };

  const confirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    const { data: reviewerEmployee } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("user_id", user?.id)
      .maybeSingle();

    const reviewerName = reviewerEmployee
      ? `${reviewerEmployee.first_name} ${reviewerEmployee.last_name}`
      : "HR Team";

    const status = actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : "paid";

    await updateStatusMutation.mutateAsync({
      requestId: selectedRequest.id,
      status,
      reviewerId: reviewerEmployee?.id || null,
      reviewerName,
      reviewNotes,
    });

    toast({
      title: status === "approved" ? "Claim Approved" : status === "rejected" ? "Claim Rejected" : "Marked as Paid",
      description: `The reimbursement request has been ${status}.`,
    });
    setSelectedRequest(null);
    setReviewNotes("");
    setActionType(null);
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const processedRequests = requests.filter((r) => r.status === "rejected" || r.status === "paid");

  // Nobody approves their own claim; only reimbursements:manage marks claims paid
  const approvableIds = new Set(
    canApprove ? pendingRequests.filter((r) => r.employeeId !== myEmployeeId).map((r) => r.id) : [],
  );
  const payableIds = new Set(canMarkPaid ? approvedRequests.map((r) => r.id) : []);
  const selectableIds = activeTab === "pending" ? approvableIds : activeTab === "approved" ? payableIds : new Set<string>();
  const selected = requests.filter((r) => selectedIds.has(r.id) && selectableIds.has(r.id));
  const selectedTotal = selected.reduce((sum, r) => sum + r.amount, 0);

  const toggleSelected = (id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const allSelected = selectableIds.size > 0 && selected.length === selectableIds.size;
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? new Set(selectableIds) : new Set());

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  const confirmBulkAction = async () => {
    if (!bulkAction || selected.length === 0) return;
    const status = bulkAction === "approve" ? "approved" : bulkAction === "reject" ? "rejected" : "paid";
    const result = await bulkUpdateMutation.mutateAsync({
      requestIds: selected.map((r) => r.id),
      status,
      reviewerId: myEmployeeId ?? null,
      reviewNotes: bulkNotes,
    });
    const verb = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "marked as paid";
    toast({
      title: `${result.updated} ${result.updated === 1 ? "claim" : "claims"} ${verb}`,
      description:
        result.skipped > 0
          ? `${result.skipped} couldn't be updated: they may have changed in the meantime or aren't yours to review.`
          : "Each employee has been emailed.",
    });
    setBulkAction(null);
    setBulkNotes("");
    setSelectedIds(new Set());
  };

  const selectAllRow = (label: string) =>
    selectableIds.size > 1 ? (
      <label className="flex w-fit cursor-pointer items-center gap-3 px-4 text-sm text-muted-foreground sm:px-6">
        <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} className="h-5 w-5" />
        {label} ({selectableIds.size})
      </label>
    ) : null;

  const reimbursementStats = [
    { label: "Pending", value: stats?.pending || 0, icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
    { label: "Approved", value: stats?.approved || 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
    { label: "Rejected", value: stats?.rejected || 0, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
    { label: "Paid", value: stats?.paid || 0, icon: <Banknote className="h-5 w-5" />, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reimbursements</h1>
            <p className="text-muted-foreground">Submit and track expense claims</p>
          </div>
          <div className="flex gap-2">
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                New claim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>New expense claim</DialogTitle>
                <DialogDescription>Submit a reimbursement request for approval.</DialogDescription>
              </DialogHeader>

              {isLoadingMyEmployee ? (
                <Skeleton className="h-72 w-full" />
              ) : !myEmployeeId ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  We couldn't find an employee profile linked to your account. Please contact HR to link your profile.
                </div>
              ) : (
                <ReimbursementRequestForm
                  employeeId={myEmployeeId}
                  onSubmitted={() => setIsNewRequestOpen(false)}
                  onCancel={() => setIsNewRequestOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {reimbursementStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
                <div className={`shrink-0 rounded-xl bg-muted p-2.5 sm:p-3 ${stat.color}`}>{stat.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground sm:text-2xl">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            </TabsTrigger>
            {canSeeOthersRequests && (
              <TabsTrigger value="approved">
                Approved
                <Badge variant="secondary" className="ml-2">
                  {approvedRequests.length}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="processed">Processed</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No pending claims</h3>
                  <p className="text-muted-foreground">All expense claims have been processed</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectAllRow("Select all you can approve")}
                {pendingRequests.map((request) => {
                  const canApproveThisRequest = approvableIds.has(request.id);
                  return (
                    <ReimbursementCard
                      key={request.id}
                      request={request}
                      onApprove={canApproveThisRequest ? handleApprove : undefined}
                      onReject={canApproveThisRequest ? handleReject : undefined}
                      onViewReceipt={handleViewReceipt}
                      selected={selectedIds.has(request.id)}
                      onSelectedChange={canApproveThisRequest ? (c) => toggleSelected(request.id, c) : undefined}
                    />
                  );
                })}
              </>
            )}
          </TabsContent>

          {canSeeOthersRequests && (
            <TabsContent value="approved" className="mt-6 space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                  ))}
                </div>
              ) : approvedRequests.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Banknote className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">Nothing awaiting payment</h3>
                    <p className="text-muted-foreground">Approved claims awaiting disbursement will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {selectAllRow("Select all")}
                  {approvedRequests.map((request) => (
                    <ReimbursementCard
                      key={request.id}
                      request={request}
                      onMarkPaid={canMarkPaid ? handleMarkPaid : undefined}
                      onViewReceipt={handleViewReceipt}
                      selected={selectedIds.has(request.id)}
                      onSelectedChange={canMarkPaid ? (c) => toggleSelected(request.id, c) : undefined}
                    />
                  ))}
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="processed" className="mt-6 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : processedRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No processed claims</h3>
                  <p className="text-muted-foreground">Rejected and paid claims will appear here</p>
                </CardContent>
              </Card>
            ) : (
              processedRequests.map((request) => (
                <ReimbursementCard key={request.id} request={request} onViewReceipt={handleViewReceipt} />
              ))
            )}
          </TabsContent>
        </Tabs>

        {selected.length > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm">
              <span className="font-semibold text-foreground">{selected.length} selected</span>
              <span className="text-muted-foreground"> · {formatCurrency(selectedTotal, true)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              {activeTab === "pending" ? (
                <>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-red-700 hover:bg-destructive/10 dark:text-red-400"
                    onClick={() => setBulkAction("reject")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={() => setBulkAction("approve")}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve {selected.length}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setBulkAction("paid")}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Mark {selected.length} as paid
                </Button>
              )}
            </div>
          </div>
        )}

        <Dialog
          open={!!bulkAction}
          onOpenChange={(open) => {
            if (!open) {
              setBulkAction(null);
              setBulkNotes("");
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {bulkAction === "approve"
                  ? `Approve ${selected.length} ${selected.length === 1 ? "claim" : "claims"}?`
                  : bulkAction === "reject"
                  ? `Reject ${selected.length} ${selected.length === 1 ? "claim" : "claims"}?`
                  : `Mark ${selected.length} ${selected.length === 1 ? "claim" : "claims"} as paid?`}
              </DialogTitle>
              <DialogDescription>
                {bulkAction === "paid"
                  ? `Confirm these have been paid out, ${formatCurrency(selectedTotal, true)} in total.`
                  : `${formatCurrency(selectedTotal, true)} in total. Each employee is emailed the decision.`}
              </DialogDescription>
            </DialogHeader>

            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
              {selected.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">
                    {r.employee.name}
                    <span className="text-muted-foreground"> · {r.expenseDate}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(r.amount, true)}</span>
                </li>
              ))}
            </ul>

            {bulkAction !== "paid" && (
              <div className="space-y-2">
                <Label htmlFor="reimb-bulk-notes">Note to the employees (optional)</Label>
                <Textarea
                  id="reimb-bulk-notes"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Sent with every selected claim"
                  rows={3}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkAction(null);
                  setBulkNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBulkAction}
                disabled={bulkUpdateMutation.isPending}
                variant={bulkAction === "reject" ? "destructive" : "default"}
              >
                {bulkUpdateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {bulkAction === "approve" ? "Approve" : bulkAction === "reject" ? "Reject" : "Mark as paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!selectedRequest && !!actionType}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRequest(null);
              setActionType(null);
              setReviewNotes("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve"
                  ? "Approve reimbursement"
                  : actionType === "reject"
                  ? "Reject reimbursement"
                  : "Mark reimbursement as paid"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve"
                  ? "Are you sure you want to approve this expense claim?"
                  : actionType === "reject"
                  ? "Are you sure you want to reject this expense claim?"
                  : "Confirm that this expense claim has been paid out."}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="space-y-1.5 rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium">{selectedRequest.employee.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedRequest.amount, true)} • {selectedRequest.expenseDate}
                  </p>
                  {selectedRequest.description && (
                    <p className="text-sm text-muted-foreground mt-2">{selectedRequest.description}</p>
                  )}
                </div>

                {actionType !== "paid" && (
                  <div className="space-y-2">
                    <Label htmlFor="reimb-review-notes">Notes (optional)</Label>
                    <Textarea
                      id="reimb-review-notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add any notes for the employee..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setReviewNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                disabled={updateStatusMutation.isPending}
                variant={actionType === "reject" ? "destructive" : "default"}
              >
                {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Mark as paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Reimbursements;
