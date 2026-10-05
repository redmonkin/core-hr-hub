import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DialogFooter } from "@/components/ui/dialog";
import { CalendarIcon, Loader2, Paperclip, Upload, X } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useSubmitReimbursement, EXPENSE_CATEGORIES, ExpenseCategory } from "@/hooks/useReimbursements";

interface ReimbursementRequestFormProps {
  employeeId: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

const RECEIPT_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

export function ReimbursementRequestForm({ employeeId, onSubmitted, onCancel }: ReimbursementRequestFormProps) {
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSubmitted?.();
  };

  const clearReceipt = () => {
    setReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const today = startOfDay(new Date());
  const selectedDate = expenseDate ? parseISO(expenseDate) : undefined;

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reimb-category">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger id="reimb-category">
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
        <div className="min-w-0 space-y-2">
          <Label htmlFor="reimb-amount">
            Amount (₹) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reimb-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="reimb-date">
            Expense date <span className="text-destructive">*</span>
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id="reimb-date"
                type="button"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setExpenseDate(date ? format(date, "yyyy-MM-dd") : "");
                  setDatePickerOpen(false);
                }}
                disabled={(date) => date > today}
                defaultMonth={selectedDate}
                initialFocus
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reimb-description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="reimb-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly describe the expense (min. 5 characters)..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reimb-receipt">
          Receipt <span className="text-destructive">*</span>
        </Label>
        <input
          ref={fileInputRef}
          id="reimb-receipt"
          type="file"
          accept={RECEIPT_ACCEPT}
          className="peer sr-only"
          aria-describedby="reimb-receipt-hint"
          onChange={(e) => setReceipt(e.target.files?.[0] || null)}
        />
        {receipt ? (
          <div className="flex min-w-0 items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium" title={receipt.name}>
              {receipt.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{(receipt.size / 1024).toFixed(0)} KB</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={clearReceipt}
              aria-label="Remove receipt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="reimb-receipt"
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm transition-colors hover:bg-muted/50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          >
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">Choose a file to upload</span>
          </label>
        )}
        <p id="reimb-receipt-hint" className="text-xs text-muted-foreground">
          PDF, DOC, DOCX, JPG or PNG. Max 10MB.
        </p>
      </div>

      <DialogFooter className="sm:pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!isValid || submitMutation.isPending}>
          {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Submit claim
        </Button>
      </DialogFooter>
    </form>
  );
}
