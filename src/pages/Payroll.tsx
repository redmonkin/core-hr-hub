import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PayrollTable } from "@/components/payroll/PayrollTable";
import { PayslipViewDialog } from "@/components/payroll/PayslipViewDialog";
import { PayrollDetailsEditDialog } from "@/components/payroll/PayrollDetailsEditDialog";
import { SalaryStructureManager } from "@/components/payroll/SalaryStructureManager";
import { PendingSalaryRevisions } from "@/components/payroll/SalaryRevisionsPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, FileText, IndianRupee, TrendingUp, Users, Loader2, ShieldAlert, Calendar } from "lucide-react";
import { DateRangeExportDialog } from "@/components/export/DateRangeExportDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePayrollRecords, useGeneratePayroll, useUpdatePayrollStatus, useBulkUpdatePayrollStatus, type PayrollRecord } from "@/hooks/usePayroll";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { drawPdfHeader, drawPdfFooter, fetchImageAsDataUrl, formatCurrencyForPdf, PDF_TABLE_HEAD_STYLE, PDF_COLORS } from "@/lib/pdfTheme";
import { usePermissions } from "@/hooks/usePermissions";
import { usePagination } from "@/hooks/usePagination";

const months = [
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

const periodKey = (year: number, month: number) => `${year}-${month}`;
const parsePeriodKey = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
};
const periodLabel = (year: number, month: number) => `${months[month - 1]?.label ?? ""} ${year}`;

const Payroll = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("run");
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Pay-run period and History filters start as null ("auto"): they resolve to the most
  // recent month that has payroll records, so the page never opens on an empty month
  // while last cycle's payslips are still waiting to be paid.
  const [runPeriod, setRunPeriod] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyMonthState, setHistoryMonth] = useState<string | null>(null);
  const [historyYearState, setHistoryYear] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
  const { toast } = useToast();
  const { can, isLoading: roleLoading } = usePermissions();
  const canView = can("payroll", "view");
  const canManage = can("payroll", "manage");
  const { data: branding } = useCompanyBranding();

  // One query for every record; the pay-run tab, history tab and stat cards all derive from it.
  const { data: allRecords = [], isLoading: isLoadingHistory } = usePayrollRecords();
  const isLoading = isLoadingHistory;

  const latestPeriod = useMemo(() => {
    let best: { year: number; month: number } | null = null;
    for (const r of allRecords) {
      if (!best || r.year > best.year || (r.year === best.year && r.monthNum > best.month)) {
        best = { year: r.year, month: r.monthNum };
      }
    }
    return best ?? { year: currentYear, month: currentMonth };
  }, [allRecords, currentMonth, currentYear]);

  // Periods offered in the pay-run picker: every month with records, plus the current month.
  const periodOptions = useMemo(() => {
    const keys = new Map<string, { year: number; month: number }>();
    keys.set(periodKey(currentYear, currentMonth), { year: currentYear, month: currentMonth });
    allRecords.forEach((r) => keys.set(periodKey(r.year, r.monthNum), { year: r.year, month: r.monthNum }));
    return Array.from(keys.entries())
      .sort(([, a], [, b]) => b.year - a.year || b.month - a.month)
      .map(([key, p]) => ({ key, label: periodLabel(p.year, p.month) }));
  }, [allRecords, currentMonth, currentYear]);

  const effectiveRunPeriod = runPeriod ?? periodKey(latestPeriod.year, latestPeriod.month);
  const runSelection = parsePeriodKey(effectiveRunPeriod);
  const records = useMemo(
    () => allRecords.filter((r) => r.year === runSelection.year && r.monthNum === runSelection.month),
    [allRecords, runSelection.year, runSelection.month]
  );

  const historyMonth = historyMonthState ?? String(latestPeriod.month);
  const historyYear = historyYearState ?? String(latestPeriod.year);
  
  // Generate available years from records
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRecords.forEach(record => {
      if (record.year) years.add(record.year);
    });
    if (historyYear !== "all") years.add(parseInt(historyYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [allRecords, historyYear]);
  
  // Filter history records
  const filteredHistoryRecords = useMemo(() => {
    return allRecords.filter((record) => {
      const matchesSearch =
        record.employee.name.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        record.employee.email.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        record.employeeCode.toLowerCase().includes(historySearchQuery.toLowerCase());
      
      const matchesMonth = historyMonth === "all" || record.monthNum === parseInt(historyMonth);
      const matchesYear = historyYear === "all" || record.year === parseInt(historyYear);
      
      return matchesSearch && matchesMonth && matchesYear;
    });
  }, [allRecords, historySearchQuery, historyMonth, historyYear]);

  // Pagination for history records
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedHistoryRecords,
    setPage,
    setPageSize,
    canGoNext,
    canGoPrevious,
  } = usePagination(filteredHistoryRecords, { initialPageSize: 10 });

  const generatePayroll = useGeneratePayroll();
  const updateStatus = useUpdatePayrollStatus();
  const bulkUpdateStatus = useBulkUpdatePayrollStatus();

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(String(currentMonth));
  const [generateYear, setGenerateYear] = useState(String(currentYear));
  const generateYearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const handleGeneratePayroll = () => {
    generatePayroll.mutate(
      { month: parseInt(generateMonth), year: parseInt(generateYear) },
      {
        onSuccess: (data) => {
          toast({
            title: "Payroll Generated",
            description: `Successfully generated payroll for ${data.count} employees.`,
          });
          setGenerateDialogOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Failed to Generate Payroll",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Show loading while checking role
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Redirect non-admin/HR users
  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Only administrators and HR personnel can manage payroll.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleView = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  const handleEditDetails = (record: PayrollRecord) => {
    setEditRecord(record);
    setEditDetailsOpen(true);
  };

  const handleMarkProcessed = (record: PayrollRecord) => {
    updateStatus.mutate(
      { id: record.id, status: "processed" },
      {
        onSuccess: () => {
          toast({
            title: "Status Updated",
            description: `Payroll for ${record.employee.name} marked as processed.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleMarkPaid = (record: PayrollRecord) => {
    updateStatus.mutate(
      { id: record.id, status: "paid" },
      {
        onSuccess: () => {
          toast({
            title: "Status Updated",
            description: `Payroll for ${record.employee.name} marked as paid.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRevertToPending = (record: PayrollRecord) => {
    updateStatus.mutate(
      { id: record.id, status: "draft" },
      {
        onSuccess: () => {
          toast({
            title: "Status Updated",
            description: `Payroll for ${record.employee.name} reverted to pending.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleBulkMarkProcessed = (ids: string[]) => {
    bulkUpdateStatus.mutate(
      { ids, status: "processed" },
      {
        onSuccess: (data) => {
          toast({
            title: "Bulk Update Successful",
            description: `${data.count} records marked as processed.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleBulkMarkPaid = (ids: string[]) => {
    bulkUpdateStatus.mutate(
      { ids, status: "paid" },
      {
        onSuccess: (data) => {
          toast({
            title: "Bulk Update Successful",
            description: `${data.count} records marked as paid.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleBulkRevertToPending = (ids: string[]) => {
    bulkUpdateStatus.mutate(
      { ids, status: "draft" },
      {
        onSuccess: (data) => {
          toast({
            title: "Bulk Update Successful",
            description: `${data.count} records reverted to pending.`,
          });
        },
        onError: () => {
          toast({
            title: "Update Failed",
            description: "Failed to update payroll status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employee.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getFilteredByDateRange = (startDate: Date | undefined, endDate: Date | undefined) => {
    const baseData = filteredHistoryRecords.length > 0 ? filteredHistoryRecords : allRecords;
    
    if (!startDate && !endDate) {
      return baseData;
    }

    return baseData.filter((record) => {
      // Create a date from month and year (use first day of month for comparison)
      const recordDate = new Date(record.year, record.monthNum - 1, 1);
      
      if (startDate && endDate) {
        return recordDate >= startDate && recordDate <= endDate;
      } else if (startDate) {
        return recordDate >= startDate;
      } else if (endDate) {
        return recordDate <= endDate;
      }
      return true;
    });
  };

  const exportToCSV = (startDate: Date | undefined, endDate: Date | undefined) => {
    const dataToExport = getFilteredByDateRange(startDate, endDate);
    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No payroll records to export for the selected period",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Employee Code", "Employee Name", "Email", "Month", "Year", "Basic Salary", "Allowances", "Deductions", "Net Salary", "Status"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((record) =>
        [
          `"${record.employeeCode}"`,
          `"${record.employee.name}"`,
          `"${record.employee.email}"`,
          `"${record.month}"`,
          `"${record.year}"`,
          `"${record.basic}"`,
          `"${record.allowances}"`,
          `"${record.deductions}"`,
          `"${record.netSalary}"`,
          `"${record.status}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({
      title: "Export Complete",
      description: `${dataToExport.length} payroll records exported to CSV`,
    });
  };

  const exportToPDF = async (startDate: Date | undefined, endDate: Date | undefined) => {
    const dataToExport = getFilteredByDateRange(startDate, endDate);
    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No payroll records to export for the selected period",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const logoDataUrl = await fetchImageAsDataUrl(branding?.logoUrl);

    const dateRangeText = startDate || endDate
      ? `Period: ${startDate ? format(startDate, "PP") : "Beginning"} - ${endDate ? format(endDate, "PP") : "Present"}`
      : undefined;

    let currentY = drawPdfHeader(doc, {
      title: "Payroll Report",
      subtitle: dateRangeText,
      companyName: branding?.companyName,
      companyAddress: branding?.companyAddress,
      logoDataUrl,
      pageWidth,
      margin,
    });

    doc.setTextColor(...PDF_COLORS.dark);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Records: ${dataToExport.length}`, margin, currentY);
    const totalNet = dataToExport.reduce((sum, r) => sum + r.netSalary, 0);
    doc.text(`Total Net Salary: ${formatCurrencyForPdf(totalNet)}`, margin, currentY + 6);
    currentY += 16;

    autoTable(doc, {
      startY: currentY,
      head: [["Emp Code", "Name", "Email", "Month", "Year", "Basic", "Allowances", "Deductions", "Net Salary", "Status"]],
      body: dataToExport.map((record) => [
        record.employeeCode,
        record.employee.name,
        record.employee.email,
        record.month,
        record.year,
        formatCurrencyForPdf(record.basic),
        formatCurrencyForPdf(record.allowances),
        formatCurrencyForPdf(record.deductions),
        formatCurrencyForPdf(record.netSalary),
        record.status.charAt(0).toUpperCase() + record.status.slice(1),
      ]),
      styles: { fontSize: 8 },
      headStyles: PDF_TABLE_HEAD_STYLE,
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawPdfFooter(doc, { pageWidth, pageHeight, margin, pageNumber: i, totalPages: pageCount });
    }

    doc.save(`payroll-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({
      title: "Export Complete",
      description: `${dataToExport.length} payroll records exported to PDF`,
    });
  };

  // Stat cards follow whatever period the active tab is showing.
  const statsRecords = activeTab === "history"
    ? allRecords.filter((r) =>
        (historyMonth === "all" || r.monthNum === parseInt(historyMonth)) &&
        (historyYear === "all" || r.year === parseInt(historyYear)))
    : records;
  const statsPeriodLabel = activeTab === "history"
    ? historyMonth === "all" && historyYear === "all"
      ? "All time"
      : historyMonth === "all"
        ? `All of ${historyYear}`
        : historyYear === "all"
          ? `${months[parseInt(historyMonth) - 1]?.label}, all years`
          : periodLabel(parseInt(historyYear), parseInt(historyMonth))
    : periodLabel(runSelection.year, runSelection.month);
  const statsTotal = statsRecords.reduce((sum, r) => sum + r.netSalary, 0);
  const statsEmployees = new Set(statsRecords.map((r) => r.employeeId)).size;
  const statsPending = statsRecords.filter((r) => r.status === "pending").length;
  const payrollStats = [
    { label: "Total net payroll", value: formatCurrency(statsTotal), icon: <IndianRupee className="h-5 w-5" aria-hidden="true" /> },
    { label: statsEmployees === 1 ? "Employee paid" : "Employees paid", value: String(statsEmployees), icon: <Users className="h-5 w-5" aria-hidden="true" /> },
    { label: "Avg. net salary", value: formatCurrency(statsRecords.length ? statsTotal / statsRecords.length : 0), icon: <TrendingUp className="h-5 w-5" aria-hidden="true" /> },
    { label: "Pending payslips", value: String(statsPending), icon: <FileText className="h-5 w-5" aria-hidden="true" /> },
  ];
  const showLatestHistory = () => {
    setHistoryMonth(String(latestPeriod.month));
    setHistoryYear(String(latestPeriod.year));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Payroll</h1>
            <p className="text-muted-foreground">Process and track employee payroll</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DateRangeExportDialog
              title="Export payroll"
              description="Select a date range to export payroll records. Leave empty to export all records."
              onExportCSV={exportToCSV}
              onExportPDF={exportToPDF}
              disabled={allRecords.length === 0}
            />
            {canManage && (
              <Button onClick={() => setGenerateDialogOpen(true)}>
                Generate payroll
              </Button>
            )}
          </div>
        </div>

        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Generate payroll</DialogTitle>
              <DialogDescription>
                Pick the month to generate payroll for — including past months. Employees who joined
                after the selected month are skipped, and mid-month joiners are pro-rated by working days.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="generate-month">Month</Label>
                <Select value={generateMonth} onValueChange={setGenerateMonth}>
                  <SelectTrigger id="generate-month">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generate-year">Year</Label>
                <Select value={generateYear} onValueChange={setGenerateYear}>
                  <SelectTrigger id="generate-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGeneratePayroll} disabled={generatePayroll.isPending}>
                {generatePayroll.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats */}
        <section aria-label={`Payroll summary for ${statsPeriodLabel}`} className="space-y-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Summary for <span className="font-medium text-foreground">{statsPeriodLabel}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {payrollStats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4 sm:p-6">
                  <div className="w-fit rounded-xl bg-primary/10 p-2.5 text-primary sm:p-3">{stat.icon}</div>
                  <div className="mt-3 sm:mt-4">
                    <p className="break-words text-lg font-bold text-foreground sm:text-2xl">{stat.value}</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <PendingSalaryRevisions />

        {/* Payroll Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="run">Pay run</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="salary">Salary structure</TabsTrigger>
          </TabsList>

          <TabsContent value="run" className="mt-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  aria-label="Search employees"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={effectiveRunPeriod} onValueChange={setRunPeriod}>
                <SelectTrigger className="w-full sm:w-[200px]" aria-label="Pay period">
                  <Calendar className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <SelectValue placeholder="Pay period" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                      {p.key === periodKey(currentYear, currentMonth) ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No payroll records</h3>
                  <p className="text-center text-muted-foreground">
                    {records.length === 0
                      ? `Payroll hasn't been generated for ${periodLabel(runSelection.year, runSelection.month)} yet.`
                      : "No records match your search criteria"}
                  </p>
                  {records.length === 0 && canManage && (
                    <Button className="mt-4" onClick={() => {
                      setGenerateMonth(String(runSelection.month));
                      setGenerateYear(String(runSelection.year));
                      setGenerateDialogOpen(true);
                    }}>
                      Generate payroll
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <PayrollTable
                records={filteredRecords}
                onView={handleView}
                onEditDetails={handleEditDetails}
                onMarkProcessed={handleMarkProcessed}
                onMarkPaid={handleMarkPaid}
                onRevertToPending={handleRevertToPending}
                onBulkMarkProcessed={handleBulkMarkProcessed}
                onBulkMarkPaid={handleBulkMarkPaid}
                onBulkRevertToPending={handleBulkRevertToPending}
                isBulkUpdating={bulkUpdateStatus.isPending}
                canManage={canManage}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-4">
            {/* History Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee code..."
                  aria-label="Search payroll history"
                  className="pl-10"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
              </div>
              <Select value={historyMonth} onValueChange={setHistoryMonth}>
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by month">
                  <Calendar className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={historyYear} onValueChange={setHistoryYear}>
                <SelectTrigger className="w-full sm:w-[120px]" aria-label="Filter by year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoadingHistory ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredHistoryRecords.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">No records found</h3>
                  <p className="text-center text-muted-foreground">
                    {allRecords.length === 0
                      ? "No payroll history available yet"
                      : "No records match your filter criteria"}
                  </p>
                  {allRecords.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button variant="outline" onClick={showLatestHistory}>
                        Show latest month ({periodLabel(latestPeriod.year, latestPeriod.month)})
                      </Button>
                      <Button variant="ghost" onClick={() => { setHistoryMonth("all"); setHistoryYear("all"); setHistorySearchQuery(""); }}>
                        Show all records
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <PayrollTable
                  records={paginatedHistoryRecords}
                  onView={handleView}
                  onEditDetails={handleEditDetails}
                  onMarkProcessed={handleMarkProcessed}
                  onMarkPaid={handleMarkPaid}
                  onRevertToPending={handleRevertToPending}
                  onBulkMarkProcessed={handleBulkMarkProcessed}
                  onBulkMarkPaid={handleBulkMarkPaid}
                  onBulkRevertToPending={handleBulkRevertToPending}
                  isBulkUpdating={bulkUpdateStatus.isPending}
                  canManage={canManage}
                />
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} records
                      </p>
                      <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-[110px]" aria-label="Records per page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 / page</SelectItem>
                          <SelectItem value="10">10 / page</SelectItem>
                          <SelectItem value="20">20 / page</SelectItem>
                          <SelectItem value="50">50 / page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => canGoPrevious && setPage(currentPage - 1)}
                            className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {/* First page */}
                        {currentPage > 2 && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">
                              1
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        
                        {/* Ellipsis before current */}
                        {currentPage > 3 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        
                        {/* Previous page */}
                        {currentPage > 1 && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(currentPage - 1)} className="cursor-pointer">
                              {currentPage - 1}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        
                        {/* Current page */}
                        <PaginationItem>
                          <PaginationLink isActive className="cursor-pointer">
                            {currentPage}
                          </PaginationLink>
                        </PaginationItem>
                        
                        {/* Next page */}
                        {currentPage < totalPages && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(currentPage + 1)} className="cursor-pointer">
                              {currentPage + 1}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        
                        {/* Ellipsis after current */}
                        {currentPage < totalPages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        
                        {/* Last page */}
                        {currentPage < totalPages - 1 && (
                          <PaginationItem>
                            <PaginationLink onClick={() => setPage(totalPages)} className="cursor-pointer">
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => canGoNext && setPage(currentPage + 1)}
                            className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="salary" className="mt-6">
            <SalaryStructureManager canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>

      <PayslipViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        record={selectedRecord}
      />

      <PayrollDetailsEditDialog
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        record={editRecord}
      />
    </DashboardLayout>
  );
};

export default Payroll;