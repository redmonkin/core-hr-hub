import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Calendar, Clock, UserCheck } from "lucide-react";
import { statusBadgeClass, formatStatus, pluralizeDays } from "@/lib/statusStyles";
import { leaveTypeBadgeClass } from "./typeBadgeStyles";

export interface LeaveRequest {
  id: string;
  employeeId?: string;
  employee: {
    name: string;
    avatar?: string;
    department: string;
  };
  type: string;
  startDate: string;
  endDate: string;
  /** Raw yyyy-MM-dd values, for sorting/filtering */
  startDateISO?: string;
  endDateISO?: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt?: string;
  reviewedBy?: {
    name: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;
}

interface LeaveRequestCardProps {
  request: LeaveRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function LeaveRequestCard({ request, onApprove, onReject }: LeaveRequestCardProps) {
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
                <Badge
                  variant="outline"
                  className={leaveTypeBadgeClass(request.type)}
                >
                  {request.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{request.employee.department}</p>
              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="whitespace-nowrap">
                    {request.startDate === request.endDate
                      ? request.startDate
                      : <>{request.startDate} – {request.endDate}</>}
                  </span>
                  <span className="whitespace-nowrap font-medium text-foreground">{pluralizeDays(request.days)}</span>
                </div>
              </div>
              {request.submittedAt && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Submitted: {request.submittedAt}</span>
                </div>
              )}
              {request.reason && <p className="mt-2 text-sm text-muted-foreground">{request.reason}</p>}
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
                <p className="mt-1 text-xs text-muted-foreground italic">
                  Note: {request.reviewNotes}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
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
