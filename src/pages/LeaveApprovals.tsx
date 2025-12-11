import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2, ClipboardCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface LeaveRequestWithEmployee {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  leave_types: { name: string } | null;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    designation: string;
  } | null;
}

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const LeaveApprovals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithEmployee | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  // Fetch pending leave requests that the user can manage
  const { data: requests, isLoading } = useQuery({
    queryKey: ["leave-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          reason,
          status,
          created_at,
          leave_types (name),
          employees!leave_requests_employee_id_fkey (id, first_name, last_name, email, designation)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LeaveRequestWithEmployee[];
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      reviewNotes 
    }: { 
      requestId: string; 
      status: "approved" | "rejected"; 
      reviewNotes: string;
    }) => {
      // Get current user's employee ID for reviewed_by
      const { data: employeeData } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status,
          review_notes: reviewNotes.trim() || null,
          reviewed_by: employeeData?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leave-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success(`Leave request ${variables.status} successfully`);
      setSelectedRequest(null);
      setReviewNotes("");
      setActionType(null);
    },
    onError: (error) => {
      toast.error("Failed to update request: " + error.message);
    },
  });

  const handleAction = (request: LeaveRequestWithEmployee, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(action);
    setReviewNotes("");
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;
    
    updateRequestMutation.mutate({
      requestId: selectedRequest.id,
      status: actionType === "approve" ? "approved" : "rejected",
      reviewNotes,
    });
  };

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  const RequestTable = ({ data, showActions }: { data: LeaveRequestWithEmployee[]; showActions: boolean }) => (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {request.employees?.first_name?.[0]}{request.employees?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {request.employees?.first_name} {request.employees?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{request.employees?.designation}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{request.leave_types?.name || "Leave"}</TableCell>
              <TableCell>
                {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell>{request.days_count}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={request.reason || ""}>
                {request.reason || "-"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusStyles[request.status]}>
                  {request.status}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-600 hover:bg-emerald-50"
                      onClick={() => handleAction(request, "approve")}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleAction(request, "reject")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leave Approvals</h2>
          <p className="text-muted-foreground">Review and manage employee leave requests</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="processed" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Processed ({processedRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingRequests.length > 0 ? (
                <RequestTable data={pendingRequests} showActions />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                    <h3 className="text-lg font-semibold">All caught up!</h3>
                    <p className="text-muted-foreground">No pending leave requests to review</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="processed">
              {processedRequests.length > 0 ? (
                <RequestTable data={processedRequests} showActions={false} />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No processed requests</h3>
                    <p className="text-muted-foreground">Processed requests will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "Approve" : "Reject"} Leave Request
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve" 
                  ? "Are you sure you want to approve this leave request?" 
                  : "Are you sure you want to reject this leave request?"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="font-medium">
                    {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.leave_types?.name} • {selectedRequest.days_count} day(s)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRequest.start_date), "PPP")} - {format(new Date(selectedRequest.end_date), "PPP")}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add any notes for the employee..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                disabled={updateRequestMutation.isPending}
                variant={actionType === "approve" ? "default" : "destructive"}
              >
                {updateRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {actionType === "approve" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LeaveApprovals;
