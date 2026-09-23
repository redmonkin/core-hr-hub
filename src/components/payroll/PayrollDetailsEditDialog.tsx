import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndianRupee, Loader2 } from "lucide-react";
import { PayrollRecord, useUpdatePayrollDetails } from "@/hooks/usePayroll";

interface PayrollDetailsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PayrollRecord | null;
}

interface FormState {
  ltaAllowance: string;
  variablePay: string;
  pfEmployerContribution: string;
  healthInsurance: string;
  professionalTax: string;
  tds: string;
  advanceAmountAdjusted: string;
  lossOfPayDays: string;
}

const emptyForm: FormState = {
  ltaAllowance: "0",
  variablePay: "0",
  pfEmployerContribution: "0",
  healthInsurance: "0",
  professionalTax: "0",
  tds: "0",
  advanceAmountAdjusted: "0",
  lossOfPayDays: "0",
};

export function PayrollDetailsEditDialog({ open, onOpenChange, record }: PayrollDetailsEditDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const updateDetails = useUpdatePayrollDetails();

  useEffect(() => {
    if (record) {
      setForm({
        ltaAllowance: String(record.ltaAllowance),
        variablePay: String(record.variablePay),
        pfEmployerContribution: String(record.pfEmployerContribution),
        healthInsurance: String(record.healthInsurance),
        professionalTax: String(record.professionalTax),
        tds: String(record.tds),
        advanceAmountAdjusted: String(record.advanceAmountAdjusted),
        lossOfPayDays: String(record.lossOfPayDays),
      });
    } else {
      setForm(emptyForm);
    }
  }, [record]);

  if (!record) return null;

  const field = (key: keyof FormState, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="relative">
        <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={key}
          type="number"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="pl-9"
          placeholder="0"
        />
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDetails.mutateAsync({
        id: record.id,
        employeeId: record.employeeId,
        basicSalary: record.basic,
        ltaAllowance: parseFloat(form.ltaAllowance) || 0,
        variablePay: parseFloat(form.variablePay) || 0,
        pfEmployerContribution: parseFloat(form.pfEmployerContribution) || 0,
        healthInsurance: parseFloat(form.healthInsurance) || 0,
        professionalTax: parseFloat(form.professionalTax) || 0,
        tds: parseFloat(form.tds) || 0,
        advanceAmountAdjusted: parseFloat(form.advanceAmountAdjusted) || 0,
        lossOfPayDays: parseFloat(form.lossOfPayDays) || 0,
      });
      onOpenChange(false);
    } catch {
      // Errors are surfaced via the mutation's onError toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payroll Details</DialogTitle>
          <DialogDescription>
            {record.employee.name} — {record.month}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Earnings</h4>
            <div className="grid grid-cols-2 gap-4">
              {field("ltaAllowance", "LTA Allowance")}
              {field("variablePay", "Variable Pay")}
              {field("pfEmployerContribution", "PF Employer Contribution")}
              {field("healthInsurance", "Health Insurance")}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Deductions</h4>
            <div className="grid grid-cols-2 gap-4">
              {field("professionalTax", "Professional Tax")}
              {field("tds", "TDS")}
              {field("advanceAmountAdjusted", "Advance Amount Adjusted")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lossOfPayDays">Loss of Pay (Days)</Label>
            <Input
              id="lossOfPayDays"
              type="number"
              step="0.5"
              min="0"
              value={form.lossOfPayDays}
              onChange={(e) => setForm({ ...form, lossOfPayDays: e.target.value })}
              placeholder="0"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDetails.isPending}>
              {updateDetails.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
