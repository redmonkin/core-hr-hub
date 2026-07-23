import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, Upload } from "lucide-react";
import { useSubmitReimbursement, EXPENSE_CATEGORIES, ExpenseCategory } from "@/hooks/useReimbursements";

interface ReimbursementRequestFormProps {
  employeeId: string;
  onSubmitted?: () => void;
}

const RECEIPT_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

export function ReimbursementRequestForm({ employeeId, onSubmitted }: ReimbursementRequestFormProps) {
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const submitMutation = useSubmitReimbursement();

  const amountValue = Number(amount);
  const isValid =
    !!category &&
    !!expenseDate &&
    amount.trim().length > 0 &&
    amountValue > 0 &&
    description.trim().length >= 5 &&
    !!receipt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !category || !receipt) return;

    await submitMutation.mutateAsync({
      employeeId,
      category,
      amount: amountValue,
      expenseDate,
      description,
      receipt,
    });

    setCategory("");
    setAmount("");
    setExpenseDate("");
    setDescription("");
    setReceipt(null);
    onSubmitted?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          New Expense Claim
        </CardTitle>
        <CardDescription>Submit a reimbursement request for approval</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select expense category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount (₹) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Expense Date <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={expenseDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description <span className="text-destructive">*</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the expense (min. 5 characters)..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Receipt <span className="text-destructive">*</span></Label>
            <Input
              type="file"
              accept={RECEIPT_ACCEPT}
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG or PNG. Max 10MB.</p>
          </div>

          <Button type="submit" disabled={!isValid || submitMutation.isPending} className="w-full">
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Submit Claim
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
