import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PayrollTable } from "@/components/payroll/PayrollTable";
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
import { Search, FileText, IndianRupee, TrendingUp, Users, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollRecords, usePayrollStats, useGeneratePayroll, useUpdatePayrollStatus, type PayrollRecord } from "@/hooks/usePayroll";
import { useIsAdminOrHR } from "@/hooks/useUserRole";

const Payroll = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("current");
  const { toast } = useToast();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const { data: records = [], isLoading } = usePayrollRecords(
    monthFilter === "current" ? currentMonth : undefined,
    monthFilter === "current" ? currentYear : undefined
  );
  const { data: stats } = usePayrollStats();
  const generatePayroll = useGeneratePayroll();
  const updateStatus = useUpdatePayrollStatus();

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

  const handleDownload = (record: { employee: { name: string } }) => {
    toast({
      title: "Downloading Payslip",
      description: `Generating PDF for ${record.employee.name}...`,
    });
  };

  const handleView = (record: { employee: { name: string } }) => {
    toast({
      title: "View Payslip",
      description: `Opening payslip for ${record.employee.name}`,
    });
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
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Export All
            </Button>
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
                onDownload={handleDownload}
                onMarkProcessed={handleMarkProcessed}
                onMarkPaid={handleMarkPaid}
                onRevertToPending={handleRevertToPending}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">Payroll history will be displayed here once records are generated.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="mt-6">
            <SalaryStructureManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Payroll;