import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeaveRequestCard, LeaveRequest } from "@/components/leaves/LeaveRequestCard";
import { LeaveRequestForm } from "@/components/profile/LeaveRequestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader as ModalHeader, DialogTitle as ModalTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, Clock, CheckCircle, XCircle, ArrowUpDown, Tag } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLeaveRequests, useLeaveStats, useUpdateLeaveStatus } from "@/hooks/useLeaves";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";
import { format, parseISO, isWithinInterval, isAfter, isBefore } from "date-fns";

const Leaves = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const { isAdminOrHR, roles } = useIsAdminOrHR();
  
  const canApproveLeaves = isAdminOrHR || roles.includes("manager");

  const { data: myEmployeeId, isLoading: isLoadingMyEmployee } = useQuery({
    queryKey: ["my-employee-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user?.id,
  });

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

  const filterByDateRange = (items: LeaveRequest[], startDate?: Date, endDate?: Date) => {
    if (!startDate && !endDate) return items;
    
    return items.filter((req) => {
      const leaveStartDate = parseISO(req.startDate);
      
      if (startDate && endDate) {
        return isWithinInterval(leaveStartDate, { start: startDate, end: endDate });
      }
      if (startDate) return isAfter(leaveStartDate, startDate) || leaveStartDate.getTime() === startDate.getTime();
      if (endDate) return isBefore(leaveStartDate, endDate) || leaveStartDate.getTime() === endDate.getTime();
      return true;
    });
  };

  const exportToCSV = (startDate?: Date, endDate?: Date) => {
    const allRequests = [...pendingRequests, ...processedRequests];
    const filteredRequests = filterByDateRange(allRequests, startDate, endDate);
    const headers = ["Employee", "Department", "Type", "Start Date", "End Date", "Days", "Status", "Reason"];
    const csvContent = [
      headers.join(","),
      ...filteredRequests.map((req) =>
        [
          `"${req.employee.name}"`,
          `"${req.employee.department}"`,
          `"${req.type}"`,
          `"${req.startDate}"`,
          `"${req.endDate}"`,
          `"${req.days}"`,
          `"${req.status}"`,
          `"${req.reason || ''}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    link.download = `leave-requests${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({
      title: "Export Complete",
      description: `${filteredRequests.length} leave requests exported to CSV`,
    });
  };

  const exportToPDF = (startDate?: Date, endDate?: Date) => {
    const allRequests = [...pendingRequests, ...processedRequests];
    const filteredRequests = filterByDateRange(allRequests, startDate, endDate);
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Leave Requests Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    if (startDate || endDate) {
      doc.text(`Date Range: ${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`, 14, 36);
      doc.text(`Total Requests: ${filteredRequests.length}`, 14, 42);
    } else {
      doc.text(`Total Requests: ${filteredRequests.length} | Pending: ${pendingRequests.length} | Processed: ${processedRequests.length}`, 14, 36);
    }

    autoTable(doc, {
      startY: startDate || endDate ? 50 : 44,
      head: [["Employee", "Department", "Type", "Start Date", "End Date", "Days", "Status"]],
      body: filteredRequests.map((req) => [
        req.employee.name,
        req.employee.department,
        req.type,
        req.startDate,
        req.endDate,
        req.days.toString(),
        req.status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const dateRange = startDate || endDate ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` : "";
    doc.save(`leave-requests${dateRange}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({
      title: "Export Complete",
      description: `${filteredRequests.length} leave requests exported to PDF`,
    });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  // Sorting for pending requests
  const pendingSorting = useSorting<LeaveRequest>(pendingRequests);
  // Sorting for processed requests  
  const processedSorting = useSorting<LeaveRequest>(processedRequests);

  const pendingPagination = usePagination(pendingSorting.sortedItems, { initialPageSize: 10 });
  const processedPagination = usePagination(processedSorting.sortedItems, { initialPageSize: 10 });

  const leaveStats = [
    { label: "Pending", value: stats?.pending || 0, icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
    { label: "Approved", value: stats?.approved || 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
    { label: "Rejected", value: stats?.rejected || 0, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
  ];

  const sortOptions = [
    { key: "startDate", label: "Date", icon: Calendar },
    { key: "days", label: "Duration", icon: Clock },
    { key: "type", label: "Type", icon: Tag },
  ] as const;

  const renderSortDropdown = (sorting: ReturnType<typeof useSorting<LeaveRequest>>) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowUpDown className="h-4 w-4" />
          Sort by {sorting.sortConfig.key ? sortOptions.find(o => o.key === sorting.sortConfig.key)?.label : "..."}
          {sorting.sortConfig.direction && (sorting.sortConfig.direction === "asc" ? " ↑" : " ↓")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sortOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.key}
              onClick={() => sorting.requestSort(option.key as keyof LeaveRequest)}
              className={sorting.sortConfig.key === option.key ? "bg-accent" : ""}
            >
              <Icon className="mr-2 h-4 w-4" />
              {option.label}
              {sorting.sortConfig.key === option.key && (
                <span className="ml-2">{sorting.sortConfig.direction === "asc" ? "↑" : "↓"}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderPaginationControls = (pagination: ReturnType<typeof usePagination>) => {
    if (pagination.totalPages <= 1) return null;
    
    const getPageNumbers = () => {
      const pages: (number | "ellipsis")[] = [];
      const { currentPage, totalPages } = pagination;
      
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push("ellipsis");
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
          pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push("ellipsis");
        pages.push(totalPages);
      }
      return pages;
    };

    return (
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select value={pagination.pageSize.toString()} onValueChange={(v) => pagination.setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>of {pagination.totalItems} requests</span>
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => pagination.canGoPrevious && pagination.goToPreviousPage()}
                className={!pagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {getPageNumbers().map((page, idx) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => pagination.setPage(page)}
                    isActive={pagination.currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => pagination.canGoNext && pagination.goToNextPage()}
                className={!pagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
            <p className="text-muted-foreground">Manage and track leave requests</p>
          </div>
          <div className="flex gap-3">
            <DateRangeExportDialog
              title="Export Leave Requests"
              description="Export leave requests with optional date range filter based on leave start date."
              onExportCSV={exportToCSV}
              onExportPDF={exportToPDF}
            />
            <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Leave Request
                </Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Leave Request
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ModalHeader>
                <ModalTitle>New Leave Request</ModalTitle>
                <DialogDescription>Submit a leave request for approval.</DialogDescription>
              </ModalHeader>

              {isLoadingMyEmployee ? (
                <Skeleton className="h-72 w-full" />
              ) : !myEmployeeId ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  We couldn’t find an employee profile linked to your account. Please contact HR to link your profile.
                </div>
              ) : (
                <LeaveRequestForm employeeId={myEmployeeId} />
              )}
            </DialogContent>
          </Dialog>
          </div>
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
              <>
                <div className="flex justify-end">
                  {renderSortDropdown(pendingSorting)}
                </div>
                {pendingPagination.paginatedItems.map((request) => (
                  <LeaveRequestCard
                    key={request.id}
                    request={request}
                    onApprove={canApproveLeaves ? handleApprove : undefined}
                    onReject={canApproveLeaves ? handleReject : undefined}
                  />
                ))}
                {renderPaginationControls(pendingPagination)}
              </>
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
              <>
                <div className="flex justify-end">
                  {renderSortDropdown(processedSorting)}
                </div>
                {processedPagination.paginatedItems.map((request) => (
                  <LeaveRequestCard key={request.id} request={request} />
                ))}
                {renderPaginationControls(processedPagination)}
              </>
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