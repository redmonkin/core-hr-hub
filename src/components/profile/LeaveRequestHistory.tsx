import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass, formatStatus, pluralizeDays } from "@/lib/statusStyles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface LeaveRequestHistoryProps {
  employeeId: string;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  leave_types: { name: string } | null;
}

export function LeaveRequestHistory({ employeeId }: LeaveRequestHistoryProps) {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["leave-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          reason,
          status,
          created_at,
          leave_types (name)
        `)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LeaveRequest[];
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const pastRequests = requests?.filter((r) => r.status !== "pending") || [];

  const formatRange = (start: string, end: string) =>
    start === end
      ? format(new Date(start), "MMM d, yyyy")
      : `${format(new Date(start), "MMM d")} – ${format(new Date(end), "MMM d, yyyy")}`;

  const renderGroup = (title: string, items: NonNullable<typeof requests>) => (
    <div>
      <h4 className="mb-3 text-sm font-medium">{title}</h4>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.leave_types?.name || "Leave"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatRange(request.start_date, request.end_date)}</TableCell>
                <TableCell>{request.days_count}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(request.status)}>
                    {formatStatus(request.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 sm:hidden">
        {items.map((request) => (
          <li key={request.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-medium">{request.leave_types?.name || "Leave"}</p>
              <p className="text-sm text-muted-foreground">
                {formatRange(request.start_date, request.end_date)} · {pluralizeDays(Number(request.days_count))}
              </p>
            </div>
            <Badge variant="outline" className={statusBadgeClass(request.status)}>
              {formatStatus(request.status)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Leave requests
        </CardTitle>
        <CardDescription>Track your submitted leave requests</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pendingRequests.length > 0 && renderGroup(`Pending approval (${pendingRequests.length})`, pendingRequests)}
        {pastRequests.length > 0 && renderGroup(`Past requests (${pastRequests.length})`, pastRequests)}

        {(!requests || requests.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No leave requests yet</p>
            <p className="text-sm">Submit a request using the form</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
