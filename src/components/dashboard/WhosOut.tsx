import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

interface LeaveInfo {
  id: string;
  employee_name: string;
  employee_avatar?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
}

export function WhosOut() {
  const today = new Date().toISOString().split("T")[0];

  const { data: whosOut = [], isLoading } = useQuery({
    queryKey: ["whos-out-today", today],
    queryFn: async () => {
      // Get all approved leaves that include today
      const { data: leaves, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          employee_id,
          leave_type_id
        `)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

      if (error) throw error;
      if (!leaves || leaves.length === 0) return [];

      // Get employee details
      const employeeIds = [...new Set(leaves.map((l) => l.employee_id))];
      const { data: employees } = await supabase
        .from("employees")
        .select("id, first_name, last_name, avatar_url")
        .in("id", employeeIds);

      // Get leave types
      const leaveTypeIds = [...new Set(leaves.map((l) => l.leave_type_id))];
      const { data: leaveTypes } = await supabase
        .from("leave_types")
        .select("id, name")
        .in("id", leaveTypeIds);

      const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
      const leaveTypeMap = new Map(leaveTypes?.map((lt) => [lt.id, lt.name]) || []);

      return leaves.map((leave): LeaveInfo => {
        const emp = employeeMap.get(leave.employee_id);
        return {
          id: leave.id,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
          employee_avatar: emp?.avatar_url || undefined,
          leave_type: leaveTypeMap.get(leave.leave_type_id) || "Leave",
          start_date: leave.start_date,
          end_date: leave.end_date,
        };
      });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="h-5 w-5 text-warning" />
          Who's Out Today
          {whosOut.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {whosOut.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : whosOut.length > 0 ? (
          <div className="space-y-3">
            {whosOut.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center gap-3 rounded-lg bg-muted/50 p-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={leave.employee_avatar} />
                  <AvatarFallback className="text-xs">
                    {leave.employee_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{leave.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {leave.start_date === leave.end_date
                      ? "Today only"
                      : `Until ${format(parseISO(leave.end_date), "MMM d")}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {leave.leave_type}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Everyone is in today! 🎉
          </p>
        )}
      </CardContent>
    </Card>
  );
}
