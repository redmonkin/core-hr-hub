import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const activities = [
  {
    id: 1,
    user: { name: "Sarah Miller", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face", initials: "SM" },
    action: "requested",
    type: "Annual Leave",
    time: "2 hours ago",
    status: "pending",
  },
  {
    id: 2,
    user: { name: "Mike Johnson", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", initials: "MJ" },
    action: "was assigned",
    type: "MacBook Pro",
    time: "4 hours ago",
    status: "completed",
  },
  {
    id: 3,
    user: { name: "Emily Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face", initials: "EC" },
    action: "joined",
    type: "Engineering",
    time: "1 day ago",
    status: "completed",
  },
  {
    id: 4,
    user: { name: "David Brown", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face", initials: "DB" },
    action: "requested",
    type: "Sick Leave",
    time: "1 day ago",
    status: "approved",
  },
  {
    id: 5,
    user: { name: "Lisa Wang", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face", initials: "LW" },
    action: "submitted",
    type: "Documents",
    time: "2 days ago",
    status: "completed",
  },
];

const statusStyles = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-muted/50"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={activity.user.avatar} />
              <AvatarFallback>{activity.user.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium text-foreground">{activity.user.name}</span>{" "}
                <span className="text-muted-foreground">{activity.action}</span>{" "}
                <span className="font-medium text-foreground">{activity.type}</span>
              </p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
            <Badge
              variant="outline"
              className={statusStyles[activity.status as keyof typeof statusStyles]}
            >
              {activity.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
