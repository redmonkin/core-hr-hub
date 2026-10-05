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
import { Download, FileText, Loader2 } from "lucide-react";
import { usePayrollSummary } from "@/hooks/usePayrollSummary";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, formatCurrencyForPdf, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

const getStatusBadge = (status: string) => (
  <Badge variant="outline" className={statusBadgeClass(status || "draft")}>
    {formatStatus(status || "draft")}
  </Badge>
);

export function PayrollSummaryReport() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [isExporting, setIsExporting] = useState(false);

  const { data: summary, isLoading } = usePayrollSummary(
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
        title: "Monthly Payroll Summary Report",
        subtitle: summary.monthName,
        companyName: branding?.companyName,
        companyAddress: branding?.companyAddress,
        logoDataUrl,
        pageWidth,
        margin,
      });

      doc.setTextColor(...PDF_COLORS.dark);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Employees: ${summary.employeeCount}`, margin, currentY);
      currentY += 10;

      // Summary table
      autoTable(doc, {
        startY: currentY,
        head: [["Category", "Amount"]],
        body: [
          ["Total Basic Salary", formatCurrencyForPdf(summary.totalBasic)],
          ["Total Allowances", formatCurrencyForPdf(summary.totalAllowances)],
          ["Total Deductions", formatCurrencyForPdf(summary.totalDeductions)],
          ["Total Net Salary", formatCurrencyForPdf(summary.totalNetSalary)],
        ],
        theme: "grid",
        headStyles: PDF_TABLE_HEAD_STYLE,
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 60, halign: "right" },
        },
      });

      // Employee details table
      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY + 40;

      doc.setTextColor(...PDF_COLORS.dark);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Employee Payroll Details", margin, finalY + 15);

      autoTable(doc, {
        startY: finalY + 20,
        head: [["Employee", "Department", "Basic", "Allowances", "Deductions", "Net Salary", "Status"]],
        body: summary.records.map((record) => [
          record.employeeName,
          record.department,
          formatCurrencyForPdf(record.basicSalary),
          formatCurrencyForPdf(record.allowances),
          formatCurrencyForPdf(record.deductions),
          formatCurrencyForPdf(record.netSalary),
          record.status.charAt(0).toUpperCase() + record.status.slice(1),
        ]),
        foot: [[
          "TOTAL",
          "",
          formatCurrencyForPdf(summary.totalBasic),
          formatCurrencyForPdf(summary.totalAllowances),
          formatCurrencyForPdf(summary.totalDeductions),
          formatCurrencyForPdf(summary.totalNetSalary),
          "",
        ]],
        theme: "striped",
        headStyles: { ...PDF_TABLE_HEAD_STYLE, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: PDF_COLORS.ruleLight, textColor: PDF_COLORS.dark, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25, halign: "right" },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 25, halign: "right" },
          6: { cellWidth: 20 },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
      }

      doc.save(`Payroll_Summary_${summary.monthName.replace(" ", "_")}.pdf`);
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
              <FileText className="h-5 w-5" />
              Monthly payroll summary
            </CardTitle>
            <CardDescription>View and export payroll data</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[130px]" aria-label="Month">
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
              <SelectTrigger className="w-full sm:w-[100px]" aria-label="Year">
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
            <Button onClick={exportToPDF} disabled={isExporting || !summary?.records.length} className="col-span-2 sm:col-span-1">
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="min-w-0 rounded-lg border bg-muted/50 p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Total basic</p>
                <p className="break-words text-lg font-bold sm:text-2xl">{formatCurrency(summary.totalBasic)}</p>
              </div>
              <div className="min-w-0 rounded-lg border bg-muted/50 p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Total allowances</p>
                <p className="break-words text-lg font-bold text-emerald-700 dark:text-emerald-400 sm:text-2xl">{formatCurrency(summary.totalAllowances)}</p>
              </div>
              <div className="min-w-0 rounded-lg border bg-muted/50 p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Total deductions</p>
                <p className="break-words text-lg font-bold text-red-700 dark:text-red-400 sm:text-2xl">{formatCurrency(summary.totalDeductions)}</p>
              </div>
              <div className="min-w-0 rounded-lg border bg-primary/10 p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">Net payroll</p>
                <p className="break-words text-lg font-bold text-primary sm:text-2xl">{formatCurrency(summary.totalNetSalary)}</p>
              </div>
            </div>

            {/* Employee Table */}
            {summary.records.length > 0 ? (
              <>
              <div className="hidden rounded-md border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Basic</TableHead>
                      <TableHead className="text-right">Allowances</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{record.employeeCode}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.department}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.basicSalary)}</TableCell>
                        <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(record.allowances)}</TableCell>
                        <TableCell className="text-right text-red-700 dark:text-red-400">{formatCurrency(record.deductions)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(record.netSalary)}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">Total ({summary.employeeCount} {summary.employeeCount === 1 ? "employee" : "employees"})</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(summary.totalBasic)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(summary.totalAllowances)}</TableCell>
                      <TableCell className="text-right font-bold text-red-700 dark:text-red-400">{formatCurrency(summary.totalDeductions)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(summary.totalNetSalary)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <ul className="space-y-3 sm:hidden" aria-label="Employee payroll">
                {summary.records.map((record) => (
                  <li key={record.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{record.employeeName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[record.employeeCode, record.department].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Basic</dt>
                        <dd className="tabular-nums">{formatCurrency(record.basicSalary)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Allowances</dt>
                        <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(record.allowances)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Deductions</dt>
                        <dd className="tabular-nums text-red-700 dark:text-red-400">{formatCurrency(record.deductions)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Net salary</dt>
                        <dd className="font-medium tabular-nums">{formatCurrency(record.netSalary)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
                <li className="flex items-center justify-between rounded-lg border bg-muted/50 p-3 text-sm font-semibold">
                  <span>Total ({summary.employeeCount} {summary.employeeCount === 1 ? "employee" : "employees"})</span>
                  <span className="tabular-nums">{formatCurrency(summary.totalNetSalary)}</span>
                </li>
              </ul>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No payroll records found</p>
                <p className="text-sm text-muted-foreground">
                  There are no payroll records for {summary.monthName}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
