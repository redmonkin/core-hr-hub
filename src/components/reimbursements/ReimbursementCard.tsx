import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, UserCheck, Receipt, Banknote } from "lucide-react";
import { ReimbursementRequest, EXPENSE_CATEGORIES } from "@/hooks/useReimbursements";
import { formatCurrency } from "@/lib/currency";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";
import { categoryBadgeClass } from "@/components/leaves/typeBadgeStyles";

interface ReimbursementCardProps {
  request: ReimbursementRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  onViewReceipt?: (receiptUrl: string) => void;
}

const categoryLabel = (category: string) =>
  EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category;

export function ReimbursementCard({ request, onApprove, onReject, onMarkPaid, onViewReceipt }: ReimbursementCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
              <AvatarImage src={request.employee.avatar} />
              <AvatarFallback>
                {request.employee.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold text-foreground">{request.employee.name}</h3>
                <Badge variant="outline" className={categoryBadgeClass(request.category)}>
                  {categoryLabel(request.category)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{request.employee.department}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-lg font-semibold text-foreground">{formatCurrency(request.amount, true)}</span>
                <span className="text-muted-foreground">on {request.expenseDate}</span>
              </div>
              {request.submittedAt && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
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
                  View receipt
                </Button>
              )}
              {request.status !== "pending" && request.reviewedBy && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>
                    Reviewed by{" "}
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
                  <Banknote className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>
                    Paid by <span className="font-medium text-foreground">{request.paidBy.name}</span>
                    {request.paidAt && <span> on {request.paidAt}</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
            {request.status === "pending" && (onApprove || onReject) ? (
              <>
                {onApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 sm:h-9"
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
                    className="h-10 border-destructive/30 text-red-700 hover:bg-destructive/10 dark:text-red-400 sm:h-9"
                    onClick={() => onReject(request.id)}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                )}
              </>
            ) : request.status === "approved" && onMarkPaid ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusBadgeClass(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
                <Button size="sm" className="h-10 sm:h-9" onClick={() => onMarkPaid(request.id)}>
                  <Banknote className="mr-1 h-4 w-4" />
                  Mark as paid
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className={statusBadgeClass(request.status)}>
                {formatStatus(request.status)}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
