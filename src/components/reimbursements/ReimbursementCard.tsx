import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Calendar, Clock, UserCheck, Receipt, Banknote } from "lucide-react";
import { ReimbursementRequest, EXPENSE_CATEGORIES } from "@/hooks/useReimbursements";
import { formatCurrency } from "@/lib/currency";

interface ReimbursementCardProps {
  request: ReimbursementRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  onViewReceipt?: (receiptUrl: string) => void;
}

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  paid: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

const categoryLabel = (category: string) =>
  EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category;

const categoryStyles: Record<string, string> = {
  travel: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  food: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  accommodation: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  office_supplies: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  other: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function ReimbursementCard({ request, onApprove, onReject, onMarkPaid, onViewReceipt }: ReimbursementCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={request.employee.avatar} />
              <AvatarFallback>
                {request.employee.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">{request.employee.name}</h3>
                <Badge variant="secondary" className={categoryStyles[request.category] || ""}>
                  {categoryLabel(request.category)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{request.employee.department}</p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-lg font-semibold text-foreground">{formatCurrency(request.amount, true)}</span>
                <span className="text-muted-foreground">on {request.expenseDate}</span>
              </div>
              {request.submittedAt && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Submitted: {request.submittedAt}</span>
                </div>
              )}
              {request.description && (
                <p className="mt-2 break-words text-sm text-muted-foreground">{request.description}</p>
              )}
              {onViewReceipt && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-sm"
                  onClick={() => onViewReceipt(request.receiptUrl)}
                >
                  <Receipt className="mr-1 h-3.5 w-3.5" />
                  View Receipt
                </Button>
              )}
              {request.status !== "pending" && request.reviewedBy && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCheck className="h-3 w-3" />
                  <span>
                    {request.status === "rejected" ? "Rejected" : "Reviewed"} by{" "}
                    <span className="font-medium text-foreground">{request.reviewedBy.name}</span>
                    {request.reviewedAt && <span> on {request.reviewedAt}</span>}
                  </span>
                </div>
              )}
              {request.reviewNotes && (
                <p className="mt-1 text-xs text-muted-foreground italic">Note: {request.reviewNotes}</p>
              )}
              {request.status === "paid" && request.paidBy && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Banknote className="h-3 w-3" />
                  <span>
                    Paid by <span className="font-medium text-foreground">{request.paidBy.name}</span>
                    {request.paidAt && <span> on {request.paidAt}</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {request.status === "pending" && (onApprove || onReject) ? (
              <>
                {onApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10"
                    onClick={() => onApprove(request.id)}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                )}
                {onReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/20 text-destructive hover:bg-destructive/10"
                    onClick={() => onReject(request.id)}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                )}
              </>
            ) : request.status === "approved" && onMarkPaid ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusStyles[request.status] || ""}>
                  {request.status}
                </Badge>
                <Button size="sm" onClick={() => onMarkPaid(request.id)}>
                  <Banknote className="mr-1 h-4 w-4" />
                  Mark as Paid
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className={statusStyles[request.status] || ""}>
                {request.status}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
