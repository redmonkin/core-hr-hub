import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";

interface ActivityItem {
  id: string;
  userName: string;
  avatarUrl?: string;
  action: string;
  type: string;
  status: "pending" | "completed" | "approved" | "rejected" | "created";
  createdAt: string;
}

const statusStyles = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  created: "bg-primary/10 text-primary border-primary/20",
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Fetch from activity_logs table
async function fetchActivityLogs(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, details, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  // Collect user_ids that are missing employee_name in details
  const userIdsToResolve = new Set<string>();
  const parsedLogs = (data || []).map((log) => {
    const details = (typeof log.details === "object" && log.details !== null)
      ? log.details as Record<string, unknown>
      : null;
    const employeeName = (details?.employee_name as string) || "";
    if (!employeeName && log.user_id) {
      userIdsToResolve.add(log.user_id);
    }
    return { ...log, details, employeeName };
  });

  // Resolve missing names from profiles table
  const nameMap: Record<string, string> = {};
  if (userIdsToResolve.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(userIdsToResolve));
    
    if (profiles) {
      for (const p of profiles) {
        if (p.full_name) nameMap[p.id] = p.full_name;
      }
    }
  }

  return parsedLogs.map((log) => {
    const employeeName = log.employeeName || (log.user_id ? nameMap[log.user_id] : null) || "Someone";
    
    let status: ActivityItem["status"] = "completed";
    const action = log.action.toLowerCase();
    if (action.includes("approved") || action === "approved") status = "approved";
    else if (action.includes("rejected") || action === "rejected") status = "rejected";
    else if (action.includes("pending") || action === "pending") status = "pending";
    else if (action.includes("created") || action === "created") status = "created";

    const entityName = log.details?.leave_type || 
                       log.details?.asset_name ||
                       log.details?.name ||
                       log.entity_type.replace(/_/g, " ");

    // Format action text based on entity type and action
    let formattedAction = action.replace(/_/g, " ");
    const userName = employeeName;
    let type = String(entityName);
    
    if (log.entity_type === "leave_request") {
      if (status === "approved") {
        formattedAction = "'s leave request was approved";
        type = `(${entityName})`;
      } else if (status === "rejected") {
        formattedAction = "'s leave request was rejected";
        type = `(${entityName})`;
      } else if (status === "pending" || action === "created") {
        formattedAction = "requested";
        type = `${entityName} leave`;
      }
    } else if (log.entity_type === "attendance") {
      formattedAction = action.includes("out") ? "clocked out" : "clocked in";
      type = "";
    } else if (log.entity_type === "asset_assignment") {
      formattedAction = action.includes("return") ? "returned" : "was assigned";
      type = String(log.details?.asset_name || "an asset");
    }

    return {
      id: log.id,
      userName,
      action: formattedAction,
      type,
      status,
      createdAt: log.created_at,
    };
  });
}

// Fallback: fetch recent events from multiple tables
async function fetchRecentEvents(): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];

  // Fetch recent leave requests
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select(`
      id,
      status,
      created_at,
      updated_at,
      employee:employees!leave_requests_employee_id_fkey(first_name, last_name, avatar_url),
      leave_type:leave_types!leave_requests_leave_type_id_fkey(name)
    `)
    .order("updated_at", { ascending: false })
    .limit(5);

  (leaves || []).forEach((leave) => {
    const emp = leave.employee as { first_name: string; last_name: string; avatar_url: string | null } | null;
    const leaveType = leave.leave_type as { name: string } | null;
    const userName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
    
    let action = "requested";
    let status: ActivityItem["status"] = "pending";
    
    if (leave.status === "approved") {
      action = "'s leave request was approved";
      status = "approved";
    } else if (leave.status === "rejected") {
      action = "'s leave request was rejected";
      status = "rejected";
    }

    activities.push({
      id: `leave-${leave.id}`,
      userName,
      avatarUrl: emp?.avatar_url || undefined,
      action,
      type: leave.status === "pending" ? `${leaveType?.name || "Leave"} request` : `(${leaveType?.name || "Leave"})`,
      status,
      createdAt: leave.updated_at,
    });
  });

  // Fetch recent attendance
  const { data: attendance } = await supabase
    .from("attendance_records")
    .select(`
      id,
      clock_in,
      clock_out,
      date,
      created_at,
      employee:employees!attendance_records_employee_id_fkey(first_name, last_name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  (attendance || []).forEach((record) => {
    const emp = record.employee as { first_name: string; last_name: string; avatar_url: string | null } | null;
    const userName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
    
    activities.push({
      id: `att-${record.id}`,
      userName,
      avatarUrl: emp?.avatar_url || undefined,
      action: record.clock_out ? "clocked out" : "clocked in",
      type: "attendance",
      status: "completed",
      createdAt: record.clock_out || record.clock_in || record.created_at,
    });
  });

  // Fetch recent asset assignments
  const { data: assets } = await supabase
    .from("asset_assignments")
    .select(`
      id,
      assigned_date,
      returned_date,
      created_at,
      employee:employees!asset_assignments_employee_id_fkey(first_name, last_name, avatar_url),
      asset:assets!asset_assignments_asset_id_fkey(name)
    `)
    .order("created_at", { ascending: false })
    .limit(3);

  (assets || []).forEach((assignment) => {
    const emp = assignment.employee as { first_name: string; last_name: string; avatar_url: string | null } | null;
    const asset = assignment.asset as { name: string } | null;
    const userName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
    
    activities.push({
      id: `asset-${assignment.id}`,
      userName,
      avatarUrl: emp?.avatar_url || undefined,
      action: assignment.returned_date ? "returned" : "assigned",
      type: asset?.name || "asset",
      status: "completed",
      createdAt: assignment.created_at,
    });
  });

  // Sort by date and return top 10
  return activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
}

export function RecentActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      // First try to get from activity_logs
      const logs = await fetchActivityLogs();
      if (logs.length > 0) return logs;
      
      // Fallback to recent events from other tables
      return fetchRecentEvents();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activities will appear here as actions are performed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => {
          const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50"
            >
              <Avatar className="h-9 w-9">
                {activity.avatarUrl && <AvatarFallback>{getInitials(activity.userName)}</AvatarFallback>}
                <AvatarFallback>{getInitials(activity.userName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-foreground">{activity.userName}</span>{" "}
                  <span className="text-muted-foreground">{activity.action}</span>{" "}
                  <span className="font-medium text-foreground">{activity.type}</span>
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo}</p>
              </div>
              <Badge
                variant="outline"
                className={statusStyles[activity.status] || statusStyles.completed}
              >
                {activity.status}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
