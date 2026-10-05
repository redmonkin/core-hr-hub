import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { formatStatus, pluralizeDays, statusBadgeClass } from "@/lib/statusStyles";

type Segment = { text: string; strong?: boolean };

interface ActivityItem {
  id: string;
  /** Person the row is about (used for the avatar). */
  subjectName: string;
  avatarUrl?: string;
  /** Sentence pieces; spacing/punctuation is included in the text so "Rohan Das's" renders without a stray space. */
  segments: Segment[];
  /** Short module label shown next to the time, e.g. "Leave". */
  category: string;
  /** Only set for outcomes worth a badge (approved / rejected / pending / cancelled). */
  status?: string;
  createdAt: string;
}

const BADGE_STATUSES = new Set(["approved", "rejected", "pending", "cancelled"]);

const getInitials = (name: string) => {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
};

const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

/** "leave_requests" / "leave_request" -> "leave_request" */
const normaliseEntity = (entity: string) => entity.toLowerCase().replace(/s$/, "");

/** "Casual Leave" -> "Casual Leave" (never "Casual Leave leave"/"request request") */
const leaveLabel = (leaveType?: string) => {
  const t = (leaveType || "").trim();
  if (!t) return "leave";
  return /leave$/i.test(t) ? t : `${t} leave`;
};

interface LogDetails {
  employee_name?: string;
  employee?: string;
  name?: string;
  performed_by?: string;
  leave_type?: string;
  days?: number;
  asset_name?: string;
  review_period?: string;
  amount?: number;
  [key: string]: unknown;
}

function describeLog(
  log: { id: string; action: string; entity_type: string; created_at: string },
  details: LogDetails,
  actorName: string | null,
): ActivityItem {
  const action = log.action.toLowerCase().trim();
  const entity = normaliseEntity(log.entity_type);
  const subject = (details.employee_name || details.employee || details.name || "").trim();
  const actor = (details.performed_by || actorName || "").trim();
  const actorIsSubject = !!actor && !!subject && actor === subject;
  const base = { id: log.id, createdAt: log.created_at };
  const status = BADGE_STATUSES.has(action) ? action : undefined;

  switch (entity) {
    case "employee": {
      const who = subject || "A new employee";
      if (action === "created") {
        return {
          ...base,
          subjectName: subject || actor,
          category: "People",
          segments: actor && !actorIsSubject
            ? [{ text: actor, strong: true }, { text: " added " }, { text: who, strong: true }]
            : [{ text: who, strong: true }, { text: " was added" }],
        };
      }
      if (action.startsWith("status changed to ")) {
        const next = formatStatus(action.replace("status changed to ", "")).toLowerCase();
        return {
          ...base,
          subjectName: subject,
          category: "People",
          segments: [{ text: possessive(subject || "An employee"), strong: true }, { text: ` status changed to ${next}` }],
        };
      }
      return {
        ...base,
        subjectName: subject || actor,
        category: "People",
        segments: subject
          ? [{ text: possessive(subject), strong: true }, { text: ` profile was ${action}` }]
          : [{ text: `An employee profile was ${action}` }],
      };
    }
    case "leave_request": {
      const who = subject || "Someone";
      const leave = leaveLabel(details.leave_type);
      if (action === "created" || action === "pending") {
        const days = typeof details.days === "number" && details.days > 0 ? ` (${pluralizeDays(details.days)})` : "";
        return {
          ...base,
          subjectName: who,
          category: "Leave",
          status: "pending",
          segments: [{ text: who, strong: true }, { text: " requested " }, { text: `${leave}${days}`, strong: true }],
        };
      }
      return {
        ...base,
        subjectName: who,
        category: "Leave",
        status,
        segments: [{ text: possessive(who), strong: true }, { text: ` ${leave} request was ${action}` }],
      };
    }
    case "asset_assignment": {
      const who = subject || "Someone";
      const asset = details.asset_name || "an asset";
      return {
        ...base,
        subjectName: who,
        category: "Assets",
        segments: action === "returned"
          ? [{ text: who, strong: true }, { text: " returned " }, { text: asset, strong: true }]
          : [{ text: who, strong: true }, { text: " was assigned " }, { text: asset, strong: true }],
      };
    }
    case "performance_review": {
      const who = subject || "an employee";
      const period = details.review_period ? ` ${details.review_period}` : "";
      return {
        ...base,
        subjectName: subject,
        category: "Performance",
        status,
        segments: action === "created"
          ? [{ text: `A${period} review was started for ` }, { text: who, strong: true }]
          : [{ text: possessive(subject || "An employee"), strong: true }, { text: `${period} review was ${formatStatus(action).toLowerCase()}` }],
      };
    }
    case "attendance_record":
    case "attendance": {
      const who = subject || actor || "Someone";
      return {
        ...base,
        subjectName: who,
        category: "Attendance",
        segments: [{ text: who, strong: true }, { text: action.includes("out") ? " clocked out" : " clocked in" }],
      };
    }
    case "reimbursement": {
      const amount = typeof details.amount === "number" ? `${formatINR(details.amount)} ` : "";
      return {
        ...base,
        subjectName: subject || actor,
        category: "Expenses",
        status,
        segments: subject
          ? [{ text: possessive(subject), strong: true }, { text: ` ${amount}expense claim was ${action}` }]
          : [{ text: `A ${amount}expense claim was ${action}` }],
      };
    }
    default: {
      const label = formatStatus(log.entity_type);
      return {
        ...base,
        subjectName: subject || actor,
        category: label,
        status,
        segments: subject
          ? [{ text: subject, strong: true }, { text: ` (${label.toLowerCase()}) was ${action}` }]
          : [{ text: `${label} was ${action}` }],
      };
    }
  }
}

// Fetch from activity_logs table
async function fetchActivityLogs(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, details, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  const parsedLogs = (data || []).map((log) => {
    const details = (typeof log.details === "object" && log.details !== null && !Array.isArray(log.details))
      ? (log.details as LogDetails)
      : {};
    return { ...log, details };
  });

  // Resolve the actor's name (who performed the action) when the log doesn't carry it
  const userIdsToResolve = new Set<string>();
  for (const log of parsedLogs) {
    if (!log.details.performed_by && log.user_id) userIdsToResolve.add(log.user_id);
  }
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

  return parsedLogs.map((log) =>
    describeLog(log, log.details, log.user_id ? nameMap[log.user_id] ?? null : null),
  );
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
    
    const leave_ = leaveLabel(leaveType?.name);
    const segments: Segment[] =
      leave.status === "pending"
        ? [{ text: userName, strong: true }, { text: " requested " }, { text: leave_, strong: true }]
        : [{ text: possessive(userName), strong: true }, { text: ` ${leave_} request was ${leave.status}` }];

    activities.push({
      id: `leave-${leave.id}`,
      subjectName: userName,
      avatarUrl: emp?.avatar_url || undefined,
      segments,
      category: "Leave",
      status: BADGE_STATUSES.has(leave.status) ? leave.status : undefined,
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
      subjectName: userName,
      avatarUrl: emp?.avatar_url || undefined,
      segments: [{ text: userName, strong: true }, { text: record.clock_out ? " clocked out" : " clocked in" }],
      category: "Attendance",
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
    
    const assetName = asset?.name || "an asset";
    activities.push({
      id: `asset-${assignment.id}`,
      subjectName: userName,
      avatarUrl: emp?.avatar_url || undefined,
      segments: assignment.returned_date
        ? [{ text: userName, strong: true }, { text: " returned " }, { text: assetName, strong: true }]
        : [{ text: userName, strong: true }, { text: " was assigned " }, { text: assetName, strong: true }],
      category: "Assets",
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
            Recent activity
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
            Recent activity
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
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
        <ul className="space-y-1">
        {activities.map((activity) => {
          const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

          return (
            <li
              key={activity.id}
              className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50 sm:items-center sm:p-3"
            >
              <Avatar className="h-8 w-8 shrink-0 sm:h-9 sm:w-9">
                {activity.avatarUrl && <AvatarImage src={activity.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs">{getInitials(activity.subjectName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-muted-foreground line-clamp-2">
                  {activity.segments.map((seg, i) =>
                    seg.strong ? (
                      <span key={i} className="font-medium text-foreground">{seg.text}</span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>{activity.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{timeAgo}</span>
                  {activity.status && (
                    <Badge
                      variant="outline"
                      className={`ml-1 px-1.5 py-0 text-[11px] font-medium sm:hidden ${statusBadgeClass(activity.status)}`}
                    >
                      {formatStatus(activity.status)}
                    </Badge>
                  )}
                </p>
              </div>
              {activity.status && (
                <Badge
                  variant="outline"
                  className={`hidden shrink-0 sm:inline-flex ${statusBadgeClass(activity.status)}`}
                >
                  {formatStatus(activity.status)}
                </Badge>
              )}
            </li>
          );
        })}
        </ul>
      </CardContent>
    </Card>
  );
}
