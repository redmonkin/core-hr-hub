import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeaveRequestCard } from "@/components/leaves/LeaveRequestCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLeaveRequests, useLeaveStats, useUpdateLeaveStatus } from "@/hooks/useLeaves";

const Leaves = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: requests = [], isLoading } = useLeaveRequests();
  const { data: stats } = useLeaveStats();
  const updateStatus = useUpdateLeaveStatus();

  const handleApprove = (id: string) => {
    updateStatus.mutate(
      { id, status: "approved" },
      {
        onSuccess: () => {
          toast({
            title: "Leave Approved",
            description: "The leave request has been approved.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to approve leave request.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleReject = (id: string) => {
    updateStatus.mutate(
      { id, status: "rejected" },
      {
        onSuccess: () => {
          toast({
            title: "Leave Rejected",
            description: "The leave request has been rejected.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to reject leave request.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  const leaveStats = [
    { label: "Pending", value: stats?.pending || 0, icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
    { label: "Approved", value: stats?.approved || 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
    { label: "Rejected", value: stats?.rejected || 0, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
            <p className="text-muted-foreground">Manage and track leave requests</p>
          </div>
          <Button onClick={() => navigate("/profile?tab=leaves")}>
            <Plus className="mr-2 h-4 w-4" />
            New Leave Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {leaveStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-xl bg-muted p-3 ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label} Requests</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leave Requests */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processed">Processed</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
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
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No Pending Requests</h3>
                  <p className="text-muted-foreground">All leave requests have been processed</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <LeaveRequestCard
                  key={request.id}
                  request={request}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </TabsContent>

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
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No Processed Requests</h3>
                  <p className="text-muted-foreground">Processed leave requests will appear here</p>
                </CardContent>
              </Card>
            ) : (
              processedRequests.map((request) => (
                <LeaveRequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Leave Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="p-2 text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 35 }, (_, i) => {
                    const day = i - 0;
                    const isCurrentMonth = day >= 1 && day <= 31;
                    const isToday = day === new Date().getDate();
                    return (
                      <div
                        key={i}
                        className={`relative rounded-lg p-2 text-sm ${
                          isCurrentMonth
                            ? "text-foreground hover:bg-muted"
                            : "text-muted-foreground/50"
                        } ${isToday ? "ring-2 ring-primary" : ""}`}
                      >
                        {isCurrentMonth ? day : ""}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Leaves;