import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PayrollTable } from "@/components/payroll/PayrollTable";
import { PayslipViewDialog } from "@/components/payroll/PayslipViewDialog";
import { SalaryStructureManager } from "@/components/payroll/SalaryStructureManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { usePayrollRecords, usePayrollStats, useGeneratePayroll, useUpdatePayrollStatus, useBulkUpdatePayrollStatus, type PayrollRecord } from "@/hooks/usePayroll";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
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

const Payroll = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("current");
  
  // History tab filters
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyMonth, setHistoryMonth] = useState<string>("all");
  const [historyYear, setHistoryYear] = useState<string>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const { toast } = useToast();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const { data: records = [], isLoading } = usePayrollRecords(
    monthFilter === "current" ? currentMonth : undefined,
    monthFilter === "current" ? currentYear : undefined
  );
  
  // Fetch all records for history tab
  const { data: allRecords = [], isLoading: isLoadingHistory } = usePayrollRecords();
  
  const { data: stats } = usePayrollStats();
  
  // Generate available years from records
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRecords.forEach(record => {
      if (record.year) years.add(record.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allRecords]);
  
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

  const handleGeneratePayroll = () => {
    generatePayroll.mutate(
      { month: currentMonth, year: currentYear },
      {
        onSuccess: (data) => {
          toast({
            title: "Payroll Generated",
            description: `Successfully generated payroll for ${data.count} employees.`,
          });
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
  if (!isAdminOrHR) {
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

  const exportToPDF = (startDate: Date | undefined, endDate: Date | undefined) => {
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

    doc.setFontSize(20);
    doc.text("Payroll Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), "PPP")}`, 14, 30);
    if (startDate || endDate) {
      const dateRangeText = `Period: ${startDate ? format(startDate, "PP") : "Beginning"} - ${endDate ? format(endDate, "PP") : "Present"}`;
      doc.text(dateRangeText, 14, 36);
      doc.text(`Total Records: ${dataToExport.length}`, 14, 42);
      const totalNet = dataToExport.reduce((sum, r) => sum + r.netSalary, 0);
      doc.text(`Total Net Salary: ${formatCurrency(totalNet)}`, 14, 48);
    } else {
      doc.text(`Total Records: ${dataToExport.length}`, 14, 36);
      const totalNet = dataToExport.reduce((sum, r) => sum + r.netSalary, 0);
      doc.text(`Total Net Salary: ${formatCurrency(totalNet)}`, 14, 42);
    }

    autoTable(doc, {
      startY: startDate || endDate ? 56 : 50,
      head: [["Emp Code", "Name", "Email", "Month", "Year", "Basic", "Allowances", "Deductions", "Net Salary", "Status"]],
      body: dataToExport.map((record) => [
        record.employeeCode,
        record.employee.name,
        record.employee.email,
        record.month,
        record.year,
        formatCurrency(record.basic),
        formatCurrency(record.allowances),
        formatCurrency(record.deductions),
        formatCurrency(record.netSalary),
        record.status.charAt(0).toUpperCase() + record.status.slice(1),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`payroll-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({
      title: "Export Complete",
      description: `${dataToExport.length} payroll records exported to PDF`,
    });
  };

  const payrollStats = [
    { label: "Total Payroll", value: formatCurrency(stats?.totalPayroll || 0), icon: <IndianRupee className="h-5 w-5" />, change: "" },
    { label: "Employees", value: String(stats?.employeeCount || 0), icon: <Users className="h-5 w-5" />, change: "" },
    { label: "Avg. Salary", value: formatCurrency(stats?.avgSalary || 0), icon: <TrendingUp className="h-5 w-5" />, change: "" },
    { label: "Pending", value: String(stats?.pending || 0), icon: <FileText className="h-5 w-5" />, change: "" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Payroll Management</h2>
            <p className="text-muted-foreground">Process and track employee payroll</p>
          </div>
          <div className="flex gap-3">
            <DateRangeExportDialog
              title="Export Payroll"
              description="Select a date range to export payroll records. Leave empty to export all records."
              onExportCSV={exportToCSV}
              onExportPDF={exportToPDF}
              disabled={allRecords.length === 0}
            />
            <Button onClick={handleGeneratePayroll} disabled={generatePayroll.isPending}>
              {generatePayroll.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Payroll"
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {payrollStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">{stat.icon}</div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payroll Table */}
        <Tabs defaultValue="current">
          <TabsList>
            <TabsTrigger value="current">Current Month</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="salary">Salary Structure</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="all">All Records</SelectItem>
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
                  <h3 className="text-lg font-semibold text-foreground">No Payroll Records</h3>
                  <p className="text-muted-foreground">
                    {records.length === 0
                      ? "Generate payroll to see records here"
                      : "No records match your search criteria"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <PayrollTable
                records={filteredRecords}
                onView={handleView}
                onMarkProcessed={handleMarkProcessed}
                onMarkPaid={handleMarkPaid}
                onRevertToPending={handleRevertToPending}
                onBulkMarkProcessed={handleBulkMarkProcessed}
                onBulkMarkPaid={handleBulkMarkPaid}
                onBulkRevertToPending={handleBulkRevertToPending}
                isBulkUpdating={bulkUpdateStatus.isPending}
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
                  className="pl-10"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
              </div>
              <Select value={historyMonth} onValueChange={setHistoryMonth}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={historyYear} onValueChange={setHistoryYear}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
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
                  <h3 className="text-lg font-semibold text-foreground">No Records Found</h3>
                  <p className="text-muted-foreground">
                    {allRecords.length === 0
                      ? "No payroll history available yet"
                      : "No records match your filter criteria"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <PayrollTable
                  records={paginatedHistoryRecords}
                  onView={handleView}
                  onMarkProcessed={handleMarkProcessed}
                  onMarkPaid={handleMarkPaid}
                  onRevertToPending={handleRevertToPending}
                  onBulkMarkProcessed={handleBulkMarkProcessed}
                  onBulkMarkPaid={handleBulkMarkPaid}
                  onBulkRevertToPending={handleBulkRevertToPending}
                  isBulkUpdating={bulkUpdateStatus.isPending}
                />
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} records
                      </p>
                      <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-[100px]">
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
            <SalaryStructureManager />
          </TabsContent>
        </Tabs>
      </div>

      <PayslipViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        record={selectedRecord}
      />
    </DashboardLayout>
  );
};

export default Payroll;