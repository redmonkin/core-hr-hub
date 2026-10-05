import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Download, FileText, Users, Calendar, CreditCard, TrendingUp, TrendingDown, UserPlus, UserMinus, Loader2, ShieldAlert, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollSummaryReport } from "@/components/reports/PayrollSummaryReport";
import { LeaveBalanceReport } from "@/components/reports/LeaveBalanceReport";
import { AssetInventoryReport } from "@/components/reports/AssetInventoryReport";
import { AttendanceReport } from "@/components/reports/AttendanceReport";
import { EmployeeReport } from "@/components/reports/EmployeeReport";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { AppModule, canAccessReports } from "@/lib/permissions";
import {
  useEmployeeGrowthData,
  useDepartmentDistribution,
  useLeaveStatistics,
  usePayrollTrend,
  useHeadcountSummary,
} from "@/hooks/useReportsData";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const LEAVE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// Each report is shown to people who can view the module whose data it reads.
const inrCompact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
/** 1800000 -> "₹18L", 25000 -> "₹25K" */
const formatInrCompact = (value: number) => `₹${inrCompact.format(value)}`;

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const legendLabel = (value: string) => <span className="text-sm text-foreground">{value}</span>;

const reportCards: { title: string; description: string; icon: JSX.Element; sectionId: string; module: AppModule }[] = [
  { title: "Attendance report", description: "Monthly attendance tracking", icon: <Users className="h-5 w-5" />, sectionId: "report-attendance", module: "attendance" },
  { title: "Leave summary", description: "Leave balance and usage report", icon: <Calendar className="h-5 w-5" />, sectionId: "report-leave", module: "leaves" },
  { title: "Payroll report", description: "Monthly payroll breakdown", icon: <CreditCard className="h-5 w-5" />, sectionId: "report-payroll", module: "payroll" },
  { title: "Asset report", description: "Asset inventory and assignments", icon: <FileText className="h-5 w-5" />, sectionId: "report-asset", module: "assets" },
];

const Reports = () => {
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const year = parseInt(selectedYear);
  const permissions = usePermissions();
  const { can, isLoading: roleLoading } = permissions;

  const { data: employeeGrowthData, isLoading: isLoadingGrowth } = useEmployeeGrowthData(year);
  const { data: departmentData, isLoading: isLoadingDept } = useDepartmentDistribution();
  const { data: leaveStats, isLoading: isLoadingLeave } = useLeaveStatistics(year);
  const { data: payrollTrendData, isLoading: isLoadingPayroll } = usePayrollTrend(year);
  const { data: headcountData, isLoading: isLoadingHeadcount } = useHeadcountSummary(year);

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

  // Only for people who can view at least one module that has a report
  if (!canAccessReports(permissions)) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Access denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Ask an administrator for access to the modules you need reports for.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reports & analytics</h1>
          <p className="text-muted-foreground">Insights and data visualization</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <FileText className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            {can("employees") && (
              <TabsTrigger value="employee">
                <User className="mr-2 h-4 w-4" />
                Employee Report
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex justify-end">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[140px]" aria-label="Year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

        {/* Quick Reports */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {reportCards.filter((report) => can(report.module)).map((report) => (
            <button
              key={report.title}
              type="button"
              className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => {
                document.getElementById(report.sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Card className="h-full transition-all hover:shadow-lg">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-fit rounded-xl bg-primary/10 p-2.5 text-primary sm:p-3" aria-hidden="true">{report.icon}</div>
                  <div className="mt-3 sm:mt-4">
                    <p className="font-semibold text-foreground">{report.title}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        {/* Headcount Summary Widget */}
        {can("employees") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Headcount summary
            </CardTitle>
            <CardDescription>New hires, terminations, and net change for {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHeadcount ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : headcountData ? (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                  <div className="min-w-0 rounded-lg border bg-muted/50 p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">Current headcount</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold sm:text-3xl">{headcountData.currentHeadcount}</p>
                  </div>
                  <div className="min-w-0 rounded-lg border bg-muted/50 p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">Start of year</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold sm:text-3xl">{headcountData.startOfYearHeadcount}</p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950 sm:p-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                      <p className="text-sm text-emerald-800 dark:text-emerald-300">New hires</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-300 sm:text-3xl">
                      {headcountData.newHires > 0 ? `+${headcountData.newHires}` : 0}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950 sm:p-4">
                    <div className="flex items-center gap-2">
                      <UserMinus className="h-4 w-4 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
                      <p className="text-sm text-red-800 dark:text-red-300">Terminations</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-red-800 dark:text-red-300 sm:text-3xl">
                      {headcountData.terminations > 0 ? `−${headcountData.terminations}` : 0}
                    </p>
                  </div>
                  <div className={`col-span-2 min-w-0 rounded-lg border p-3 sm:p-4 lg:col-span-1 ${headcountData.netChange >= 0 ? 'bg-primary/10' : 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950'}`}>
                    <div className="flex items-center gap-2">
                      {headcountData.netChange >= 0 ? (
                        <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-4 w-4 shrink-0 text-orange-700 dark:text-orange-400" aria-hidden="true" />
                      )}
                      <p className={`text-sm ${headcountData.netChange >= 0 ? 'text-primary' : 'text-orange-800 dark:text-orange-300'}`}>
                        Net change
                      </p>
                    </div>
                    <p className={`mt-2 text-2xl font-bold sm:text-3xl ${headcountData.netChange >= 0 ? 'text-primary' : 'text-orange-800 dark:text-orange-300'}`}>
                      {headcountData.netChange > 0 ? '+' : headcountData.netChange < 0 ? '−' : ''}{Math.abs(headcountData.netChange)}
                    </p>
                  </div>
                </div>

                {/* Monthly Breakdown Chart */}
                <div
                  className="h-[250px]"
                  role="img"
                  aria-label={`New hires and terminations by month in ${selectedYear}: ${headcountData.newHires} hires, ${headcountData.terminations} terminations`}
                >
                  {headcountData.monthlyBreakdown.some((m) => m.hires > 0 || m.terminations > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={headcountData.monthlyBreakdown} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} interval="preserveStartEnd" />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend formatter={legendLabel} />
                        <Bar dataKey="hires" name="New hires" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="terminations" name="Terminations" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-muted-foreground">No headcount changes recorded for {selectedYear}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        )}

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Employee Growth */}
          {can("employees") && (
          <Card>
            <CardHeader>
              <CardTitle>Employee growth</CardTitle>
              <CardDescription>Active employees at the end of each month in {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" role="img" aria-label={`Active headcount by month in ${selectedYear}`}>
                {isLoadingGrowth ? (
                  <Skeleton className="h-full w-full" />
                ) : employeeGrowthData && employeeGrowthData.some((d) => (d.employees ?? 0) > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={employeeGrowthData} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} interval="preserveStartEnd" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="employees"
                        name="Active employees"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No employee data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Department Distribution */}
          {can("employees") && (
          <Card>
            <CardHeader>
              <CardTitle>Department distribution</CardTitle>
              <CardDescription>Active employees by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="h-[300px]"
                role="img"
                aria-label={`Active employees by department: ${(departmentData || []).map((d) => `${d.name} ${d.value}`).join(", ")}`}
              >
                {isLoadingDept ? (
                  <Skeleton className="h-full w-full" />
                ) : departmentData && departmentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={departmentData.length > 1 ? 3 : 0}
                        dataKey="value"
                        nameKey="name"
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} aria-label={`${entry.name}: ${entry.value}`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No department data available</p>
                  </div>
                )}
              </div>
              {departmentData && departmentData.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  {departmentData.map((dept) => (
                    <div key={dept.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: dept.color }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {dept.name} ({dept.value})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Leave Statistics */}
          {can("leaves") && (
          <Card>
            <CardHeader>
              <CardTitle>Leave statistics</CardTitle>
              <CardDescription>Approved leave days by month and type for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" role="img" aria-label={`Approved leave days by month and leave type in ${selectedYear}`}>
                {isLoadingLeave ? (
                  <Skeleton className="h-full w-full" />
                ) : leaveStats && leaveStats.monthlyData.some((d) => 
                    leaveStats.leaveTypeKeys.some((k) => (d[k] as number) > 0)
                  ) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leaveStats.monthlyData} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} interval="preserveStartEnd" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend formatter={legendLabel} />
                      {leaveStats.leaveTypeKeys.map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          stackId="leave"
                          fill={LEAVE_COLORS[index % LEAVE_COLORS.length]}
                          maxBarSize={32}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No leave data available for {selectedYear}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Payroll Trend */}
          {can("payroll") && (
          <Card>
            <CardHeader>
              <CardTitle>Payroll trend</CardTitle>
              <CardDescription>Monthly net payroll for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="h-[300px]"
                role="img"
                aria-label={`Monthly net payroll in ${selectedYear}: ${(payrollTrendData || []).map((d) => `${d.month} ${formatInrCompact(d.amount)}`).join(", ")}`}
              >
                {isLoadingPayroll ? (
                  <Skeleton className="h-full w-full" />
                ) : payrollTrendData && payrollTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payrollTrendData} margin={{ left: -4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={56}
                        tickFormatter={(value: number) => formatInrCompact(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Net payroll"]}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No payroll data available for {selectedYear}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>

        {/* Payroll Summary Report */}
        {can("payroll") && (
        <div id="report-payroll">
          <PayrollSummaryReport />
        </div>
        )}

        {/* Leave Balance Report */}
        {can("leaves") && (
        <div id="report-leave">
          <LeaveBalanceReport />
        </div>
        )}

        {/* Asset Inventory Report */}
        {can("assets") && (
        <div id="report-asset">
          <AssetInventoryReport />
        </div>
        )}

        {/* Attendance Report */}
        {can("attendance") && (
        <div id="report-attendance">
          <AttendanceReport />
        </div>
        )}
          </TabsContent>

          {can("employees") && (
            <TabsContent value="employee">
              <EmployeeReport />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
