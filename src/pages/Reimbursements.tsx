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
import { Receipt, Plus, Clock, CheckCircle, XCircle, Banknote, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useReimbursementRequests,
  useReimbursementStats,
  useUpdateReimbursementStatus,
  ReimbursementRequest,
} from "@/hooks/useReimbursements";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { formatCurrency } from "@/lib/currency";

const Reimbursements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const { isAdminOrHR, roles } = useIsAdminOrHR();

  const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | "paid" | null>(null);

  const canApprove = isAdminOrHR || roles.includes("manager");

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

  const reimbursementStats = [
    { label: "Pending", value: stats?.pending || 0, icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
    { label: "Approved", value: stats?.approved || 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
    { label: "Rejected", value: stats?.rejected || 0, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
    { label: "Paid", value: stats?.paid || 0, icon: <Banknote className="h-5 w-5" />, color: "text-sky-600" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reimbursements</h2>
            <p className="text-muted-foreground">Submit and track expense claims</p>
          </div>
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Expense Claim</DialogTitle>
                <DialogDescription>Submit a reimbursement request for approval.</DialogDescription>
              </DialogHeader>

              {isLoadingMyEmployee ? (
                <Skeleton className="h-72 w-full" />
              ) : !myEmployeeId ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  We couldn't find an employee profile linked to your account. Please contact HR to link your profile.
                </div>
              ) : (
                <ReimbursementRequestForm employeeId={myEmployeeId} onSubmitted={() => setIsNewRequestOpen(false)} />
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reimbursementStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-xl bg-muted p-3 ${stat.color}`}>{stat.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            </TabsTrigger>
            {canApprove && (
              <TabsTrigger value="approved">
                Approved
                <Badge variant="secondary" className="ml-2">
                  {approvedRequests.length}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="processed">History</TabsTrigger>
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
                  <h3 className="text-lg font-semibold text-foreground">No Pending Claims</h3>
                  <p className="text-muted-foreground">All expense claims have been processed</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => {
                const isOwnRequest = myEmployeeId && request.employeeId === myEmployeeId;
                const canApproveThisRequest = canApprove && !isOwnRequest;
                return (
                  <ReimbursementCard
                    key={request.id}
                    request={request}
                    onApprove={canApproveThisRequest ? handleApprove : undefined}
                    onReject={canApproveThisRequest ? handleReject : undefined}
                    onViewReceipt={handleViewReceipt}
                  />
                );
              })
            )}
          </TabsContent>

          {canApprove && (
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
                    <h3 className="text-lg font-semibold text-foreground">Nothing Awaiting Payment</h3>
                    <p className="text-muted-foreground">Approved claims awaiting disbursement will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                approvedRequests.map((request) => (
                  <ReimbursementCard
                    key={request.id}
                    request={request}
                    onMarkPaid={isAdminOrHR ? handleMarkPaid : undefined}
                    onViewReceipt={handleViewReceipt}
                  />
                ))
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
                  <h3 className="text-lg font-semibold text-foreground">No History Yet</h3>
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
                {actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Mark as Paid"} Reimbursement Request
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
                <div className="rounded-lg bg-muted p-4 space-y-2">
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
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Textarea
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
                {actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Mark as Paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Reimbursements;
