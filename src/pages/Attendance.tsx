import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, LogIn, LogOut, Calendar, Briefcase } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useAttendance, useTodayAttendance, useClockIn, useClockOut, useAttendanceReport } from "@/hooks/useAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";

const MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    present: "default",
    late: "secondary",
    absent: "destructive",
    "half-day": "outline",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

const Attendance = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);

  const { data: todayRecord, isLoading: todayLoading } = useTodayAttendance();
  const { data: attendanceRecords, isLoading: recordsLoading } = useAttendance(targetDate);
  const { data: reportData, isLoading: reportLoading } = useAttendanceReport(targetDate);
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  // Get current employee with working schedule
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, working_hours_start, working_hours_end, working_days")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Format time for display (e.g., "09:00:00" -> "9:00 AM")
  const formatTimeDisplay = (time: string | null): string => {
    if (!time) return "--:--";
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get day names for working days
  const getDayNames = (days: number[] | null): string => {
    if (!days || days.length === 0) return "Not set";
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.sort((a, b) => a - b).map(d => dayNames[d]).join(', ');
  };

  // Check if today is a working day
  const isWorkingDay = (days: number[] | null): boolean => {
    const today = new Date().getDay();
    return (days || [1, 2, 3, 4, 5]).includes(today);
  };

  // Sorting for report data
  const reportSorting = useSorting(reportData || []);
  
  // Sorting for attendance history
  const historySorting = useSorting(attendanceRecords || []);

  // Pagination for report data (uses sorted items)
  const reportPagination = usePagination(reportSorting.sortedItems, { initialPageSize: 10 });
  
  // Pagination for attendance history (uses sorted items)
  const historyPagination = usePagination(historySorting.sortedItems, { initialPageSize: 10 });

  const handleClockIn = async () => {
    if (!currentEmployee) {
      toast.error("Employee profile not found");
      return;
    }

    try {
      await clockIn.mutateAsync(currentEmployee.id);
      toast.success("Clocked in successfully");
    } catch (error) {
      toast.error("Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord || !todayRecord.clock_in) {
      toast.error("No active clock-in found");
      return;
    }

    try {
      await clockOut.mutateAsync({ recordId: todayRecord.id, clockIn: todayRecord.clock_in });
      toast.success("Clocked out successfully");
    } catch (error) {
      toast.error("Failed to clock out");
    }
  };

  const exportToCSV = (startDate?: Date, endDate?: Date) => {
    if (!reportData || reportData.length === 0) return;

    const monthName = MONTHS[parseInt(selectedMonth)].label;
    const headers = ["Employee Code", "Name", "Department", "Present Days", "Total Hours", "Avg Hours/Day"];
    const csvContent = [
      headers.join(","),
      ...reportData.map((emp) =>
        [
          `"${emp.employeeCode}"`,
          `"${emp.employeeName}"`,
          `"${emp.department}"`,
          `"${emp.presentDays}"`,
          `"${emp.totalHours.toFixed(2)}"`,
          `"${emp.totalDays > 0 ? (emp.totalHours / emp.totalDays).toFixed(2) : "0"}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate 
      ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` 
      : `-${monthName.toLowerCase()}-${selectedYear}`;
    link.download = `attendance-report${dateRange}.csv`;
    link.click();
    toast.success(`${reportData.length} attendance records exported to CSV`);
  };

  const exportToPDF = (startDate?: Date, endDate?: Date) => {
    if (!reportData || reportData.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthName = MONTHS[parseInt(selectedMonth)].label;

    doc.setFontSize(20);
    doc.text("Attendance Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    if (startDate || endDate) {
      doc.text(`${startDate ? format(startDate, "PP") : "Start"} - ${endDate ? format(endDate, "PP") : "End"}`, pageWidth / 2, 28, { align: "center" });
    } else {
      doc.text(`${monthName} ${selectedYear}`, pageWidth / 2, 28, { align: "center" });
    }

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 35, { align: "center" });

    autoTable(doc, {
      startY: 45,
      head: [["Employee Code", "Name", "Department", "Present Days", "Total Hours", "Avg Hours/Day"]],
      body: reportData.map((emp) => [
        emp.employeeCode,
        emp.employeeName,
        emp.department,
        emp.presentDays.toString(),
        emp.totalHours.toFixed(2),
        emp.totalDays > 0 ? (emp.totalHours / emp.totalDays).toFixed(2) : "0",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const dateRange = startDate || endDate 
      ? `-${startDate ? format(startDate, "yyyy-MM-dd") : "start"}-to-${endDate ? format(endDate, "yyyy-MM-dd") : "end"}` 
      : `-${monthName.toLowerCase()}-${selectedYear}`;
    doc.save(`attendance-report${dateRange}.pdf`);
    toast.success(`${reportData.length} attendance records exported to PDF`);
  };

  const currentTime = new Date();
  const isClockedIn = todayRecord?.clock_in && !todayRecord?.clock_out;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Attendance</h2>
            <p className="text-muted-foreground">Track your daily attendance and view history</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clock In/Out Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today's Attendance
            </CardTitle>
            <CardDescription>{format(currentTime, "EEEE, MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex flex-col gap-2 text-center sm:text-left">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Clock In</p>
                      <p className="text-lg font-semibold">
                        {todayRecord?.clock_in
                          ? format(new Date(todayRecord.clock_in), "hh:mm a")
                          : "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clock Out</p>
                      <p className="text-lg font-semibold">
                        {todayRecord?.clock_out
                          ? format(new Date(todayRecord.clock_out), "hh:mm a")
                          : "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-lg font-semibold">
                        {todayRecord?.total_hours
                          ? `${todayRecord.total_hours.toFixed(2)} hrs`
                          : "--"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isClockedIn && !todayRecord?.clock_out && (
                    <Button onClick={handleClockIn} disabled={clockIn.isPending}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Clock In
                    </Button>
                  )}
                  {isClockedIn && (
                    <Button onClick={handleClockOut} variant="secondary" disabled={clockOut.isPending}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Clock Out
                    </Button>
                  )}
                  {todayRecord?.clock_out && (
                    <Badge variant="outline" className="text-sm">
                      Completed for today
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Working Schedule Card */}
        {currentEmployee && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                My Working Schedule
              </CardTitle>
              <CardDescription>Your configured work hours and days for attendance reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-6 sm:flex sm:gap-8">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Time</p>
                    <p className="text-lg font-semibold">
                      {formatTimeDisplay(currentEmployee.working_hours_start)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Time</p>
                    <p className="text-lg font-semibold">
                      {formatTimeDisplay(currentEmployee.working_hours_end)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Working Days</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                        const workingDays = currentEmployee.working_days || [1, 2, 3, 4, 5];
                        const isActive = workingDays.includes(index);
                        const isToday = new Date().getDay() === index;
                        return (
                          <Badge 
                            key={day} 
                            variant={isActive ? "default" : "outline"}
                            className={`${isToday ? 'ring-2 ring-primary ring-offset-2' : ''} ${!isActive ? 'opacity-50' : ''}`}
                          >
                            {day}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {isWorkingDay(currentEmployee.working_days) ? (
                    <Badge variant="default" className="bg-green-600">Working Day</Badge>
                  ) : (
                    <Badge variant="secondary">Day Off</Badge>
                  )}
                  <a href="/profile" className="text-sm text-primary hover:underline">
                    Edit Schedule →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Report */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Monthly Attendance Report</CardTitle>
                <CardDescription>
                  {MONTHS[parseInt(selectedMonth)].label} {selectedYear}
                </CardDescription>
              </div>
            </div>
            <DateRangeExportDialog
              title="Export Attendance Report"
              description={`Export attendance report for ${MONTHS[parseInt(selectedMonth)].label} ${selectedYear}. Use date filters for custom range or leave empty to export the selected month.`}
              onExportCSV={exportToCSV}
              onExportPDF={exportToPDF}
              disabled={reportLoading || !reportData?.length}
            />
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : reportData && reportData.length > 0 ? (
              <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortKey="employeeCode"
                        currentSortKey={reportSorting.sortConfig.key as string | null}
                        direction={reportSorting.sortConfig.key === "employeeCode" ? reportSorting.sortConfig.direction : null}
                        onSort={(key) => reportSorting.requestSort(key as keyof typeof reportSorting.sortedItems[0])}
                      >
                        Employee Code
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="employeeName"
                        currentSortKey={reportSorting.sortConfig.key as string | null}
                        direction={reportSorting.sortConfig.key === "employeeName" ? reportSorting.sortConfig.direction : null}
                        onSort={(key) => reportSorting.requestSort(key as keyof typeof reportSorting.sortedItems[0])}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="department"
                        currentSortKey={reportSorting.sortConfig.key as string | null}
                        direction={reportSorting.sortConfig.key === "department" ? reportSorting.sortConfig.direction : null}
                        onSort={(key) => reportSorting.requestSort(key as keyof typeof reportSorting.sortedItems[0])}
                      >
                        Department
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="presentDays"
                        currentSortKey={reportSorting.sortConfig.key as string | null}
                        direction={reportSorting.sortConfig.key === "presentDays" ? reportSorting.sortConfig.direction : null}
                        onSort={(key) => reportSorting.requestSort(key as keyof typeof reportSorting.sortedItems[0])}
                      >
                        Present Days
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="totalHours"
                        currentSortKey={reportSorting.sortConfig.key as string | null}
                        direction={reportSorting.sortConfig.key === "totalHours" ? reportSorting.sortConfig.direction : null}
                        onSort={(key) => reportSorting.requestSort(key as keyof typeof reportSorting.sortedItems[0])}
                      >
                        Total Hours
                      </SortableTableHead>
                      <TableHead>Avg Hours/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportPagination.paginatedItems.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell className="font-medium">{emp.employeeCode}</TableCell>
                        <TableCell>{emp.employeeName}</TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>{emp.presentDays}</TableCell>
                        <TableCell>{emp.totalHours.toFixed(2)} hrs</TableCell>
                        <TableCell>
                          {emp.totalDays > 0 ? (emp.totalHours / emp.totalDays).toFixed(2) : "0"} hrs
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for report */}
              {reportPagination.totalPages > 1 && (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show</span>
                    <Select value={reportPagination.pageSize.toString()} onValueChange={(v) => reportPagination.setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((size) => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>of {reportPagination.totalItems} records</span>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => reportPagination.canGoPrevious && reportPagination.goToPreviousPage()}
                          className={!reportPagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {(() => {
                        const pages: (number | "ellipsis")[] = [];
                        const { currentPage, totalPages } = reportPagination;
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
                        return pages.map((page, idx) =>
                          page === "ellipsis" ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => reportPagination.setPage(page)}
                                isActive={reportPagination.currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        );
                      })()}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => reportPagination.canGoNext && reportPagination.goToNextPage()}
                          className={!reportPagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No attendance records for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle>My Attendance History</CardTitle>
            <CardDescription>Your attendance records for {MONTHS[parseInt(selectedMonth)].label}</CardDescription>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : attendanceRecords && attendanceRecords.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortKey="date"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "date" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Date
                      </SortableTableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <SortableTableHead
                        sortKey="total_hours"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "total_hours" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Total Hours
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="status"
                        currentSortKey={historySorting.sortConfig.key as string | null}
                        direction={historySorting.sortConfig.key === "status" ? historySorting.sortConfig.direction : null}
                        onSort={(key) => historySorting.requestSort(key as keyof typeof historySorting.sortedItems[0])}
                      >
                        Status
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPagination.paginatedItems.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {record.clock_in ? format(new Date(record.clock_in), "hh:mm a") : "-"}
                        </TableCell>
                        <TableCell>
                          {record.clock_out ? format(new Date(record.clock_out), "hh:mm a") : "-"}
                        </TableCell>
                        <TableCell>
                          {record.total_hours ? `${record.total_hours.toFixed(2)} hrs` : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for history */}
              {historyPagination.totalPages > 1 && (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show</span>
                    <Select value={historyPagination.pageSize.toString()} onValueChange={(v) => historyPagination.setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((size) => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>of {historyPagination.totalItems} records</span>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => historyPagination.canGoPrevious && historyPagination.goToPreviousPage()}
                          className={!historyPagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {(() => {
                        const pages: (number | "ellipsis")[] = [];
                        const { currentPage, totalPages } = historyPagination;
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
                        return pages.map((page, idx) =>
                          page === "ellipsis" ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => historyPagination.setPage(page)}
                                isActive={historyPagination.currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        );
                      })()}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => historyPagination.canGoNext && historyPagination.goToNextPage()}
                          className={!historyPagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No attendance records found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
