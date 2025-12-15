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
import { Download, FileText, Users, Calendar, CreditCard } from "lucide-react";
import { PayrollSummaryReport } from "@/components/reports/PayrollSummaryReport";
import { LeaveBalanceReport } from "@/components/reports/LeaveBalanceReport";
import { AssetInventoryReport } from "@/components/reports/AssetInventoryReport";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEmployeeGrowthData,
  useDepartmentDistribution,
  useLeaveStatistics,
  usePayrollTrend,
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

const reportCards = [
  { title: "Employee Report", description: "Full employee directory with details", icon: <Users className="h-5 w-5" /> },
  { title: "Leave Summary", description: "Leave balance and usage report", icon: <Calendar className="h-5 w-5" /> },
  { title: "Payroll Report", description: "Monthly payroll breakdown", icon: <CreditCard className="h-5 w-5" /> },
  { title: "Asset Report", description: "Asset inventory and assignments", icon: <FileText className="h-5 w-5" /> },
];

const Reports = () => {
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const year = parseInt(selectedYear);

  const { data: employeeGrowthData, isLoading: isLoadingGrowth } = useEmployeeGrowthData(year);
  const { data: departmentData, isLoading: isLoadingDept } = useDepartmentDistribution();
  const { data: leaveStats, isLoading: isLoadingLeave } = useLeaveStatistics(year);
  const { data: payrollTrendData, isLoading: isLoadingPayroll } = usePayrollTrend(year);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
            <p className="text-muted-foreground">Insights and data visualization</p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reportCards.map((report) => (
            <Card key={report.title} className="cursor-pointer transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">{report.icon}</div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <p className="font-semibold text-foreground">{report.title}</p>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Employee Growth */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Growth</CardTitle>
              <CardDescription>Monthly headcount trend for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingGrowth ? (
                  <Skeleton className="h-full w-full" />
                ) : employeeGrowthData && employeeGrowthData.some((d) => d.employees > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={employeeGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="employees"
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

          {/* Department Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Department Distribution</CardTitle>
              <CardDescription>Active employees by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
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
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
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

          {/* Leave Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Statistics</CardTitle>
              <CardDescription>Leave days taken by month for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingLeave ? (
                  <Skeleton className="h-full w-full" />
                ) : leaveStats && leaveStats.monthlyData.some((d) => 
                    leaveStats.leaveTypeKeys.some((k) => (d[k] as number) > 0)
                  ) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leaveStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      {leaveStats.leaveTypeKeys.map((key, index) => (
                        <Bar 
                          key={key} 
                          dataKey={key} 
                          fill={LEAVE_COLORS[index % LEAVE_COLORS.length]} 
                          radius={[4, 4, 0, 0]} 
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

          {/* Payroll Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Trend</CardTitle>
              <CardDescription>Monthly payroll expenses for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingPayroll ? (
                  <Skeleton className="h-full w-full" />
                ) : payrollTrendData && payrollTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payrollTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
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
        </div>

        {/* Payroll Summary Report */}
        <PayrollSummaryReport />

        {/* Leave Balance Report */}
        <LeaveBalanceReport />

        {/* Asset Inventory Report */}
        <AssetInventoryReport />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
