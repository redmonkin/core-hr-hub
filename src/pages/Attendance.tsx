import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, LogIn, LogOut, Calendar, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useAttendance, useTodayAttendance, useClockIn, useClockOut, useAttendanceReport } from "@/hooks/useAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Get current employee
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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

  const exportToPDF = () => {
    if (!reportData || reportData.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthName = MONTHS[parseInt(selectedMonth)].label;

    doc.setFontSize(20);
    doc.text("Attendance Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`${monthName} ${selectedYear}`, pageWidth / 2, 28, { align: "center" });

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

    doc.save(`attendance-report-${monthName.toLowerCase()}-${selectedYear}.pdf`);
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
            <Button onClick={exportToPDF} disabled={reportLoading || !reportData?.length}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : reportData && reportData.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Present Days</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Avg Hours/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((emp) => (
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
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
