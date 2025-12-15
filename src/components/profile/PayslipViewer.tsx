import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Download, FileText, Wallet, ChevronDown, ChevronUp, Plus, Minus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PayslipViewerProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

interface SalaryStructure {
  basic_salary: number;
  hra: number | null;
  transport_allowance: number | null;
  medical_allowance: number | null;
  other_allowances: number | null;
  tax_deduction: number | null;
  other_deductions: number | null;
}

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Paid</Badge>;
    case "processed":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Processed</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
};

export function PayslipViewer({ employeeId, employeeName, employeeCode }: PayslipViewerProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Fetch payroll records for the employee
  const { data: payrollRecords, isLoading } = useQuery({
    queryKey: ["my-payslips", employeeId, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", parseInt(selectedYear))
        .order("month", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch salary structure for detailed breakdown
  const { data: salaryStructure } = useQuery({
    queryKey: ["my-salary-structure", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as SalaryStructure | null;
    },
    enabled: !!employeeId,
  });

  const getAllowanceBreakdown = () => {
    if (!salaryStructure) return [];
    const items = [];
    if (salaryStructure.hra) items.push({ label: "House Rent Allowance (HRA)", amount: salaryStructure.hra });
    if (salaryStructure.transport_allowance) items.push({ label: "Transport Allowance", amount: salaryStructure.transport_allowance });
    if (salaryStructure.medical_allowance) items.push({ label: "Medical Allowance", amount: salaryStructure.medical_allowance });
    if (salaryStructure.other_allowances) items.push({ label: "Other Allowances", amount: salaryStructure.other_allowances });
    return items;
  };

  const getDeductionBreakdown = () => {
    if (!salaryStructure) return [];
    const items = [];
    if (salaryStructure.tax_deduction) items.push({ label: "Tax Deduction", amount: salaryStructure.tax_deduction });
    if (salaryStructure.other_deductions) items.push({ label: "Other Deductions", amount: salaryStructure.other_deductions });
    return items;
  };

  const downloadPayslip = (record: typeof payrollRecords extends (infer T)[] ? T : never) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthName = MONTHS.find((m) => m.value === String(record.month))?.label || "";

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PAYSLIP", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${record.year}`, pageWidth / 2, 35, { align: "center" });

    // Employee Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Employee Details", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${employeeName}`, 14, 58);
    doc.text(`Employee Code: ${employeeCode}`, 14, 65);
    doc.text(`Pay Period: ${monthName} ${record.year}`, 14, 72);
    doc.text(`Payment Status: ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}`, 14, 79);

    // Earnings section
    const allowanceBreakdown = getAllowanceBreakdown();
    const earningsBody: [string, string][] = [
      ["Basic Salary", formatCurrency(record.basic_salary)],
    ];
    
    if (allowanceBreakdown.length > 0) {
      allowanceBreakdown.forEach((item) => {
        earningsBody.push([item.label, formatCurrency(item.amount)]);
      });
    } else {
      earningsBody.push(["Total Allowances", formatCurrency(Number(record.total_allowances) || 0)]);
    }

    const grossSalary = record.basic_salary + (Number(record.total_allowances) || 0);
    earningsBody.push(["Gross Salary", formatCurrency(grossSalary)]);

    autoTable(doc, {
      startY: 90,
      head: [["Earnings", "Amount"]],
      body: earningsBody,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60, halign: "right" },
      },
    });

    const earningsY = (doc as any).lastAutoTable.finalY + 10;

    // Deductions section
    const deductionBreakdown = getDeductionBreakdown();
    const deductionsBody: [string, string][] = [];
    
    if (deductionBreakdown.length > 0) {
      deductionBreakdown.forEach((item) => {
        deductionsBody.push([item.label, formatCurrency(item.amount)]);
      });
    }
    deductionsBody.push(["Total Deductions", formatCurrency(Number(record.total_deductions) || 0)]);

    autoTable(doc, {
      startY: earningsY,
      head: [["Deductions", "Amount"]],
      body: deductionsBody,
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60, halign: "right" },
      },
    });

    const deductionsY = (doc as any).lastAutoTable.finalY + 10;

    // Net Pay section
    autoTable(doc, {
      startY: deductionsY,
      head: [["Net Pay", "Amount"]],
      body: [["Total Net Salary", formatCurrency(record.net_salary)]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 11, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60, halign: "right" },
      },
    });

    // Footer
    const footerY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("This is a computer-generated payslip and does not require a signature.", pageWidth / 2, footerY, {
      align: "center",
    });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, footerY + 6, { align: "center" });

    doc.save(`Payslip_${employeeCode}_${monthName}_${record.year}.pdf`);
  };

  const allowanceBreakdown = getAllowanceBreakdown();
  const deductionBreakdown = getDeductionBreakdown();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>My Payslips</CardTitle>
              <CardDescription>View and download your salary statements</CardDescription>
            </div>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Salary Structure Breakdown Card */}
        {salaryStructure && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Salary Structure Breakdown</CardTitle>
              <CardDescription>Your current salary components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Earnings */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <Plus className="h-4 w-4" />
                    <span className="font-semibold">Earnings</span>
                  </div>
                  <div className="space-y-2 rounded-lg border bg-background p-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-medium">{formatCurrency(salaryStructure.basic_salary)}</span>
                    </div>
                    {allowanceBreakdown.map((item) => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-green-600">+{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Gross Salary</span>
                      <span>
                        {formatCurrency(
                          salaryStructure.basic_salary +
                            (salaryStructure.hra || 0) +
                            (salaryStructure.transport_allowance || 0) +
                            (salaryStructure.medical_allowance || 0) +
                            (salaryStructure.other_allowances || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <Minus className="h-4 w-4" />
                    <span className="font-semibold">Deductions</span>
                  </div>
                  <div className="space-y-2 rounded-lg border bg-background p-4">
                    {deductionBreakdown.length > 0 ? (
                      <>
                        {deductionBreakdown.map((item) => (
                          <div key={item.label} className="flex justify-between">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-red-600">-{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total Deductions</span>
                          <span className="text-red-600">
                            -{formatCurrency(
                              (salaryStructure.tax_deduction || 0) +
                                (salaryStructure.other_deductions || 0)
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">No deductions configured</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="mt-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Net Salary (Monthly)</span>
                  <span className="font-bold text-xl text-primary">
                    {formatCurrency(
                      salaryStructure.basic_salary +
                        (salaryStructure.hra || 0) +
                        (salaryStructure.transport_allowance || 0) +
                        (salaryStructure.medical_allowance || 0) +
                        (salaryStructure.other_allowances || 0) -
                        (salaryStructure.tax_deduction || 0) -
                        (salaryStructure.other_deductions || 0)
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payslip History */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : payrollRecords && payrollRecords.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-semibold">Payslip History</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map((record) => {
                    const monthName = MONTHS.find((m) => m.value === String(record.month))?.label || "";
                    const isExpanded = expandedRecord === record.id;
                    return (
                      <>
                        <TableRow key={record.id} className="cursor-pointer" onClick={() => setExpandedRecord(isExpanded ? null : record.id)}>
                          <TableCell>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{monthName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.basic_salary)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            +{formatCurrency(Number(record.total_allowances) || 0)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            -{formatCurrency(Number(record.total_deductions) || 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(record.net_salary)}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPayslip(record);
                              }}
                              disabled={record.status === "draft"}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <p className="font-medium text-green-600 flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Earnings Breakdown
                                  </p>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Basic Salary</span>
                                      <span>{formatCurrency(record.basic_salary)}</span>
                                    </div>
                                    {allowanceBreakdown.length > 0 ? (
                                      allowanceBreakdown.map((item) => (
                                        <div key={item.label} className="flex justify-between">
                                          <span className="text-muted-foreground">{item.label}</span>
                                          <span className="text-green-600">+{formatCurrency(item.amount)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Allowances</span>
                                        <span className="text-green-600">+{formatCurrency(Number(record.total_allowances) || 0)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="font-medium text-red-600 flex items-center gap-1">
                                    <Minus className="h-3 w-3" /> Deductions Breakdown
                                  </p>
                                  <div className="space-y-1 text-sm">
                                    {deductionBreakdown.length > 0 ? (
                                      deductionBreakdown.map((item) => (
                                        <div key={item.label} className="flex justify-between">
                                          <span className="text-muted-foreground">{item.label}</span>
                                          <span className="text-red-600">-{formatCurrency(item.amount)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Deductions</span>
                                        <span className="text-red-600">-{formatCurrency(Number(record.total_deductions) || 0)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Payslips Found</p>
            <p className="text-sm text-muted-foreground">
              There are no payroll records for {selectedYear}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
