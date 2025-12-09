import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeaveRequestCard, LeaveRequest } from "@/components/leaves/LeaveRequestCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "1",
    employee: {
      name: "Sarah Miller",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      department: "Engineering",
    },
    type: "Annual",
    startDate: "Dec 9, 2024",
    endDate: "Dec 11, 2024",
    days: 3,
    reason: "Family vacation planned for the holidays",
    status: "pending",
  },
  {
    id: "2",
    employee: {
      name: "Mike Johnson",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      department: "Design",
    },
    type: "Sick",
    startDate: "Dec 8, 2024",
    endDate: "Dec 8, 2024",
    days: 1,
    reason: "Not feeling well, need rest",
    status: "pending",
  },
  {
    id: "3",
    employee: {
      name: "Emily Chen",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      department: "Marketing",
    },
    type: "Annual",
    startDate: "Dec 15, 2024",
    endDate: "Dec 20, 2024",
    days: 6,
    reason: "Year-end vacation",
    status: "pending",
  },
  {
    id: "4",
    employee: {
      name: "David Brown",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      department: "Engineering",
    },
    type: "Casual",
    startDate: "Dec 5, 2024",
    endDate: "Dec 5, 2024",
    days: 1,
    reason: "Personal appointment",
    status: "approved",
  },
  {
    id: "5",
    employee: {
      name: "Lisa Wang",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      department: "HR",
    },
    type: "Sick",
    startDate: "Dec 2, 2024",
    endDate: "Dec 3, 2024",
    days: 2,
    reason: "Doctor appointment and recovery",
    status: "approved",
  },
];

const leaveStats = [
  { label: "Pending", value: 5, icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
  { label: "Approved", value: 12, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
  { label: "Rejected", value: 2, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
];

const Leaves = () => {
  const [requests, setRequests] = useState(mockLeaveRequests);
  const { toast } = useToast();

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "approved" as const } : req))
    );
    toast({
      title: "Leave Approved",
      description: "The leave request has been approved.",
    });
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "rejected" as const } : req))
    );
    toast({
      title: "Leave Rejected",
      description: "The leave request has been rejected.",
    });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
            <p className="text-muted-foreground">Manage and track leave requests</p>
          </div>
          <Button>
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
            {pendingRequests.length === 0 ? (
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
            {processedRequests.map((request) => (
              <LeaveRequestCard key={request.id} request={request} />
            ))}
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>December 2024</CardTitle>
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
                    const hasLeave = [9, 10, 11, 15, 16, 17, 18, 19, 20].includes(day);
                    const isToday = day === 9;
                    return (
                      <div
                        key={i}
                        className={`relative rounded-lg p-2 text-sm ${
                          isCurrentMonth
                            ? hasLeave
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted"
                            : "text-muted-foreground/50"
                        } ${isToday ? "ring-2 ring-primary" : ""}`}
                      >
                        {isCurrentMonth ? day : ""}
                        {hasLeave && isCurrentMonth && (
                          <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                        )}
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
