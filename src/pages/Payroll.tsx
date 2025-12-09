import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PayrollTable, PayrollRecord } from "@/components/payroll/PayrollTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockPayrollRecords: PayrollRecord[] = [
  {
    id: "1",
    employee: {
      name: "Sarah Miller",
      email: "sarah.miller@company.com",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    },
    month: "December 2024",
    basic: 6000,
    allowances: 1500,
    deductions: 800,
    netSalary: 6700,
    status: "pending",
  },
  {
    id: "2",
    employee: {
      name: "Mike Johnson",
      email: "mike.johnson@company.com",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    month: "December 2024",
    basic: 5500,
    allowances: 1200,
    deductions: 700,
    netSalary: 6000,
    status: "pending",
  },
  {
    id: "3",
    employee: {
      name: "Emily Chen",
      email: "emily.chen@company.com",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    },
    month: "December 2024",
    basic: 7000,
    allowances: 1800,
    deductions: 900,
    netSalary: 7900,
    status: "processing",
  },
  {
    id: "4",
    employee: {
      name: "David Brown",
      email: "david.brown@company.com",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    },
    month: "November 2024",
    basic: 5000,
    allowances: 1000,
    deductions: 600,
    netSalary: 5400,
    status: "paid",
  },
  {
    id: "5",
    employee: {
      name: "Lisa Wang",
      email: "lisa.wang@company.com",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    },
    month: "November 2024",
    basic: 5200,
    allowances: 1100,
    deductions: 650,
    netSalary: 5650,
    status: "paid",
  },
];

const payrollStats = [
  { label: "Total Payroll", value: "$124,500", icon: <DollarSign className="h-5 w-5" />, change: "+8.2%" },
  { label: "Employees", value: "248", icon: <Users className="h-5 w-5" />, change: "+12" },
  { label: "Avg. Salary", value: "$5,845", icon: <TrendingUp className="h-5 w-5" />, change: "+3.1%" },
  { label: "Pending", value: "5", icon: <FileText className="h-5 w-5" />, change: "-2" },
];

const Payroll = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("dec-2024");
  const { toast } = useToast();

  const handleDownload = (record: PayrollRecord) => {
    toast({
      title: "Downloading Payslip",
      description: `Generating PDF for ${record.employee.name}...`,
    });
  };

  const handleView = (record: PayrollRecord) => {
    toast({
      title: "View Payslip",
      description: `Opening payslip for ${record.employee.name}`,
    });
  };

  const filteredRecords = mockPayrollRecords.filter((record) => {
    const matchesSearch =
      record.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employee.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
            <Button>Generate Payroll</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {payrollStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">{stat.icon}</div>
                  <span className="text-sm font-medium text-emerald-600">{stat.change}</span>
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
                  <SelectItem value="dec-2024">December 2024</SelectItem>
                  <SelectItem value="nov-2024">November 2024</SelectItem>
                  <SelectItem value="oct-2024">October 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <PayrollTable
              records={filteredRecords}
              onView={handleView}
              onDownload={handleDownload}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {["November 2024", "October 2024", "September 2024"].map((month) => (
                    <div
                      key={month}
                      className="flex items-center justify-between rounded-xl border border-border p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">{month}</p>
                        <p className="text-sm text-muted-foreground">248 employees processed</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">$1,245,000</p>
                        <Button variant="link" className="h-auto p-0 text-sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Salary Components</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Basic Salary", description: "Base salary component", percentage: "50%" },
                    { name: "HRA", description: "House Rent Allowance", percentage: "20%" },
                    { name: "Special Allowance", description: "Performance based", percentage: "15%" },
                    { name: "Transport", description: "Commute allowance", percentage: "10%" },
                    { name: "Medical", description: "Health benefits", percentage: "5%" },
                  ].map((component) => (
                    <div
                      key={component.name}
                      className="flex items-center justify-between rounded-xl bg-muted/50 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">{component.name}</p>
                        <p className="text-sm text-muted-foreground">{component.description}</p>
                      </div>
                      <span className="font-semibold text-primary">{component.percentage}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Deductions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Tax", description: "Income tax deduction", percentage: "10%" },
                    { name: "Insurance", description: "Health & life insurance", percentage: "3%" },
                    { name: "Provident Fund", description: "Retirement savings", percentage: "5%" },
                  ].map((deduction) => (
                    <div
                      key={deduction.name}
                      className="flex items-center justify-between rounded-xl bg-muted/50 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">{deduction.name}</p>
                        <p className="text-sm text-muted-foreground">{deduction.description}</p>
                      </div>
                      <span className="font-semibold text-destructive">-{deduction.percentage}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Payroll;
