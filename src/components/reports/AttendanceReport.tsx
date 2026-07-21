import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Clock, AlertTriangle, Timer, Loader2 } from "lucide-react";
import { useAttendanceReportData } from "@/hooks/useAttendanceReport";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}));

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatHours = (hours: number) => {
  return `${hours.toFixed(1)}h`;
};

export function AttendanceReport() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [isExporting, setIsExporting] = useState(false);

  const { data: summary, isLoading } = useAttendanceReportData(
    parseInt(selectedMonth),
    parseInt(selectedYear)
  );
  const { data: branding } = useCompanyBranding();

  const exportToPDF = async () => {
    if (!summary) return;

    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

      let currentY = drawPdfHeader(doc, {
        title: "Attendance Report",
        subtitle: `Late Arrivals & Overtime — ${summary.monthName}`,
        companyName: branding?.companyName,
        companyAddress: branding?.companyAddress,
        logoDataUrl,
        pageWidth,
        margin,
      });

      // Summary stats
      doc.setTextColor(...PDF_COLORS.dark);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Employees: ${summary.totalEmployees}`, margin, currentY);
      doc.text(`Total Late Arrivals: ${summary.totalLateArrivals}`, margin, currentY + 7);
      doc.text(`Total Overtime: ${formatHours(summary.totalOvertimeHours)}`, margin, currentY + 14);
      doc.text(`Average Late Time: ${formatDuration(summary.avgLateMinutes)}`, margin, currentY + 21);
      currentY += 32;

      // Employee details table
      autoTable(doc, {
        startY: currentY,
        head: [["Employee", "Code", "Department", "Days Worked", "Total Hours", "Late Arrivals", "Late Time", "Overtime"]],
        body: summary.records.map((record) => [
          record.employeeName,
          record.employeeCode,
          record.department,
          record.totalDays.toString(),
          formatHours(record.totalHours),
          record.lateArrivals.toString(),
          formatDuration(record.totalLateMinutes),
          formatHours(record.totalOvertimeHours),
        ]),
        foot: [[
          "TOTAL",
          "",
          "",
          summary.records.reduce((sum, r) => sum + r.totalDays, 0).toString(),
          formatHours(summary.records.reduce((sum, r) => sum + r.totalHours, 0)),
          summary.totalLateArrivals.toString(),
          formatDuration(summary.records.reduce((sum, r) => sum + r.totalLateMinutes, 0)),
          formatHours(summary.totalOvertimeHours),
        ]],
        theme: "striped",
        headStyles: PDF_TABLE_HEAD_STYLE,
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: PDF_COLORS.ruleLight, textColor: PDF_COLORS.dark, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 22, halign: "center" },
          6: { cellWidth: 22, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
      }

      doc.save(`Attendance_Report_${summary.monthName.replace(" ", "_")}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendance Report
            </CardTitle>
            <CardDescription>Late arrivals and overtime tracking</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px]">
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
                {YEARS.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportToPDF} disabled={isExporting || !summary?.records.length}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{summary.totalEmployees}</p>
              </div>
              <div className="rounded-lg border bg-red-500/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-600">Late Arrivals</p>
                </div>
                <p className="mt-1 text-2xl font-bold text-red-600">{summary.totalLateArrivals}</p>
                <p className="text-xs text-muted-foreground">Avg: {formatDuration(summary.avgLateMinutes)}</p>
              </div>
              <div className="rounded-lg border bg-orange-500/10 p-4">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-orange-600" />
                  <p className="text-sm text-orange-600">Total Overtime</p>
                </div>
                <p className="mt-1 text-2xl font-bold text-orange-600">{formatHours(summary.totalOvertimeHours)}</p>
              </div>
              <div className="rounded-lg border bg-primary/10 p-4">
                <p className="text-sm text-muted-foreground">Report Period</p>
                <p className="text-2xl font-bold text-primary">{summary.monthName}</p>
              </div>
            </div>

            {/* Employee Table */}
            {summary.records.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Days Worked</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-center">Late Arrivals</TableHead>
                      <TableHead className="text-right">Late Time</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.records.map((record) => (
                      <TableRow key={record.employeeId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{record.employeeCode}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.department}</TableCell>
                        <TableCell className="text-center">{record.totalDays}</TableCell>
                        <TableCell className="text-right">{formatHours(record.totalHours)}</TableCell>
                        <TableCell className="text-center">
                          {record.lateArrivals > 0 ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20">
                              {record.lateArrivals}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">0</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.totalLateMinutes > 0 ? (
                            <span className="text-red-600">{formatDuration(record.totalLateMinutes)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.totalOvertimeHours > 0 ? (
                            <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
                              {formatHours(record.totalOvertimeHours)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">
                        Total ({summary.totalEmployees} employees)
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {summary.records.reduce((sum, r) => sum + r.totalDays, 0)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatHours(summary.records.reduce((sum, r) => sum + r.totalHours, 0))}
                      </TableCell>
                      <TableCell className="text-center font-bold text-red-600">
                        {summary.totalLateArrivals}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatDuration(summary.records.reduce((sum, r) => sum + r.totalLateMinutes, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-600">
                        {formatHours(summary.totalOvertimeHours)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No attendance records found</p>
                <p className="text-sm text-muted-foreground">
                  There are no attendance records for {summary.monthName}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
