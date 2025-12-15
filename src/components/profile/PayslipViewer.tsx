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
import { Download, FileText, Wallet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PayslipViewerProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
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
    doc.text("Employee Details", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${employeeName}`, 14, 58);
    doc.text(`Employee Code: ${employeeCode}`, 14, 65);
    doc.text(`Pay Period: ${monthName} ${record.year}`, 14, 72);
    doc.text(`Payment Status: ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}`, 14, 79);

    // Salary Breakdown
    const allowances = Number(record.total_allowances) || 0;
    const deductions = Number(record.total_deductions) || 0;

    autoTable(doc, {
      startY: 90,
      head: [["Description", "Amount"]],
      body: [
        ["Basic Salary", formatCurrency(record.basic_salary)],
        ["Total Allowances", formatCurrency(allowances)],
        ["Gross Salary", formatCurrency(record.basic_salary + allowances)],
      ],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60, halign: "right" },
      },
    });

    const earningsY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: earningsY,
      head: [["Deductions", "Amount"]],
      body: [["Total Deductions", formatCurrency(deductions)]],
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60, halign: "right" },
      },
    });

    const deductionsY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: deductionsY,
      head: [["Net Pay", "Amount"]],
      body: [["Total Net Salary", formatCurrency(record.net_salary)]],
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
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
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : payrollRecords && payrollRecords.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
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
                  return (
                    <TableRow key={record.id}>
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
                          onClick={() => downloadPayslip(record)}
                          disabled={record.status === "draft"}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
