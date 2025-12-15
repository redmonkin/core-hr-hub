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
} from "recharts";
import { Download, FileText, Users, Calendar, CreditCard } from "lucide-react";
import { PayrollSummaryReport } from "@/components/reports/PayrollSummaryReport";
import { LeaveBalanceReport } from "@/components/reports/LeaveBalanceReport";
import { AssetInventoryReport } from "@/components/reports/AssetInventoryReport";

const employeeGrowthData = [
  { month: "Jan", employees: 210 },
  { month: "Feb", employees: 215 },
  { month: "Mar", employees: 222 },
  { month: "Apr", employees: 228 },
  { month: "May", employees: 235 },
  { month: "Jun", employees: 240 },
  { month: "Jul", employees: 245 },
  { month: "Aug", employees: 248 },
  { month: "Sep", employees: 250 },
  { month: "Oct", employees: 252 },
  { month: "Nov", employees: 255 },
  { month: "Dec", employees: 260 },
];

const departmentData = [
  { name: "Engineering", value: 85, color: "hsl(var(--chart-1))" },
  { name: "Design", value: 32, color: "hsl(var(--chart-2))" },
  { name: "Marketing", value: 45, color: "hsl(var(--chart-3))" },
  { name: "Sales", value: 38, color: "hsl(var(--chart-4))" },
  { name: "HR", value: 20, color: "hsl(var(--chart-5))" },
  { name: "Finance", value: 28, color: "hsl(var(--primary))" },
];

const leaveData = [
  { month: "Jan", annual: 45, sick: 12, casual: 8 },
  { month: "Feb", annual: 38, sick: 15, casual: 10 },
  { month: "Mar", annual: 52, sick: 8, casual: 12 },
  { month: "Apr", annual: 42, sick: 10, casual: 9 },
  { month: "May", annual: 48, sick: 14, casual: 11 },
  { month: "Jun", annual: 55, sick: 9, casual: 13 },
];

const payrollTrendData = [
  { month: "Jul", amount: 115000 },
  { month: "Aug", amount: 118000 },
  { month: "Sep", amount: 120000 },
  { month: "Oct", amount: 121500 },
  { month: "Nov", amount: 123000 },
  { month: "Dec", amount: 124500 },
];

const reportCards = [
  { title: "Employee Report", description: "Full employee directory with details", icon: <Users className="h-5 w-5" /> },
  { title: "Leave Summary", description: "Leave balance and usage report", icon: <Calendar className="h-5 w-5" /> },
  { title: "Payroll Report", description: "Monthly payroll breakdown", icon: <CreditCard className="h-5 w-5" /> },
  { title: "Asset Report", description: "Asset inventory and assignments", icon: <FileText className="h-5 w-5" /> },
];

const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
            <p className="text-muted-foreground">Insights and data visualization</p>
          </div>
          <Select defaultValue="2024">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
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
              <CardDescription>Monthly headcount trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
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
              </div>
            </CardContent>
          </Card>

          {/* Department Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Department Distribution</CardTitle>
              <CardDescription>Employees by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
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
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                {departmentData.map((dept) => (
                  <div key={dept.name} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="text-sm text-muted-foreground">{dept.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leave Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Statistics</CardTitle>
              <CardDescription>Leave types by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveData}>
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
                    <Bar dataKey="annual" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sick" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="casual" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[hsl(var(--chart-1))]" />
                  <span className="text-sm text-muted-foreground">Annual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[hsl(var(--chart-2))]" />
                  <span className="text-sm text-muted-foreground">Sick</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[hsl(var(--chart-3))]" />
                  <span className="text-sm text-muted-foreground">Casual</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payroll Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Trend</CardTitle>
              <CardDescription>Monthly payroll expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
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
