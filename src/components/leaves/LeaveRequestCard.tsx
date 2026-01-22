import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Calendar, Clock } from "lucide-react";

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
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt?: string;
}

interface LeaveRequestCardProps {
  request: LeaveRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const statusStyles = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const leaveTypeStyles: Record<string, string> = {
  Annual: "bg-primary/10 text-primary",
  Sick: "bg-amber-500/10 text-amber-600",
  Casual: "bg-blue-500/10 text-blue-600",
  Unpaid: "bg-muted text-muted-foreground",
};

export function LeaveRequestCard({ request, onApprove, onReject }: LeaveRequestCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={request.employee.avatar} />
              <AvatarFallback>
                {request.employee.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{request.employee.name}</h3>
                <Badge
                  variant="secondary"
                  className={leaveTypeStyles[request.type] || leaveTypeStyles.Casual}
                >
                  {request.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{request.employee.department}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {request.startDate} - {request.endDate}
                </span>
                <span className="text-foreground font-medium">({request.days} days)</span>
              </div>
              {request.submittedAt && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Submitted: {request.submittedAt}</span>
                </div>
              )}
              {request.reason && <p className="mt-2 text-sm text-muted-foreground">{request.reason}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
