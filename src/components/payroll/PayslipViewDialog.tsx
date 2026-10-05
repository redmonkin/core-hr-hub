import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { statusBadgeClass } from "@/lib/statusStyles";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Minus } from "lucide-react";

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employee: {
    name: string;
    email: string;
    avatar?: string;
  };
  month: string;
  monthNum: number;
  year: number;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "paid" | "pending" | "processing";
  paidAt?: string;
}

interface PayslipViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PayrollRecord | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

const STATUS_LABELS: Record<string, string> = { paid: "Paid", processing: "Processing", pending: "Pending" };

const getStatusBadge = (status: string) => (
  <Badge variant="outline" className={statusBadgeClass(status)}>
    {STATUS_LABELS[status] ?? "Pending"}
  </Badge>
);

export function PayslipViewDialog({ open, onOpenChange, record }: PayslipViewDialogProps) {
  const { data: salaryStructure, isLoading } = useQuery({
    queryKey: ["salary-structure-view", record?.employeeId],
    queryFn: async () => {
      if (!record?.employeeId) return null;
      const { data, error } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("employee_id", record.employeeId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!record?.employeeId && open,
  });

  if (!record) return null;

  const getAllowanceBreakdown = () => {
    if (!salaryStructure) return [];
    const items = [];
    if (salaryStructure.hra) items.push({ label: "House rent allowance (HRA)", amount: Number(salaryStructure.hra) });
    if (salaryStructure.transport_allowance) items.push({ label: "Transport allowance", amount: Number(salaryStructure.transport_allowance) });
    if (salaryStructure.medical_allowance) items.push({ label: "Medical allowance", amount: Number(salaryStructure.medical_allowance) });
    if (salaryStructure.other_allowances) items.push({ label: "Other allowances", amount: Number(salaryStructure.other_allowances) });
    return items;
  };

  const getDeductionBreakdown = () => {
    if (!salaryStructure) return [];
    const items = [];
    if (salaryStructure.tax_deduction) items.push({ label: "Tax deduction", amount: Number(salaryStructure.tax_deduction) });
    if (salaryStructure.pf_deduction) items.push({ label: "PF deduction", amount: Number(salaryStructure.pf_deduction) });
    return items;
  };

  const allowanceBreakdown = getAllowanceBreakdown();
  const deductionBreakdown = getDeductionBreakdown();
  const grossSalary = record.basic + record.allowances;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Payslip — {record.month}</DialogTitle>
          <DialogDescription>Salary breakdown for {record.employee.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Details */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 font-semibold">Employee details</h3>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="ml-2 font-medium">{record.employee.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Employee code:</span>
                <span className="ml-2 font-medium">{record.employeeCode}</span>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2 break-all font-medium">{record.employee.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pay period:</span>
                <span className="ml-2 font-medium">{record.month}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2">{getStatusBadge(record.status)}</span>
                {record.paidAt && (
                  <span className="ml-2 text-muted-foreground text-xs">({record.paidAt})</span>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Earnings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span className="font-semibold">Earnings</span>
                </div>
                <div className="space-y-2 rounded-lg border bg-background p-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic salary</span>
                    <span className="font-medium">{formatCurrency(record.basic)}</span>
                  </div>
                  {allowanceBreakdown.length > 0 ? (
                    allowanceBreakdown.map((item) => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">+{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total allowances</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">+{formatCurrency(record.allowances)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Gross salary</span>
                    <span>{formatCurrency(grossSalary)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Minus className="h-4 w-4" aria-hidden="true" />
                  <span className="font-semibold">Deductions</span>
                </div>
                <div className="space-y-2 rounded-lg border bg-background p-4">
                  {deductionBreakdown.length > 0 ? (
                    <>
                      {deductionBreakdown.map((item) => (
                        <div key={item.label} className="flex justify-between">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium text-red-700 dark:text-red-400">-{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <Separator />
                    </>
                  ) : null}
                  <div className="flex justify-between font-semibold">
                    <span>Total deductions</span>
                    <span className="text-red-700 dark:text-red-400">-{formatCurrency(record.deductions)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Net Salary */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold">Net salary</span>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(record.netSalary)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center italic">
            This is a computer-generated payslip view.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
