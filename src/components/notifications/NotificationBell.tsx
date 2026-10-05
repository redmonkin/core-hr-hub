import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/** The list query is capped at 50 rows; beyond that only the server count is exact. */
const LIST_LIMIT = 50;

const typeIcon = (type: string) => {
  switch (type) {
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
    default:
      return <Info className="h-4 w-4 text-primary" aria-hidden="true" />;
  }
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading, isSuccess } = useNotifications();
  const { data: serverUnreadCount = 0 } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Keep the badge consistent with what the panel shows: once the list has loaded,
  // count the unread items in it (unless the list is truncated).
  const listUnreadCount = notifications.filter((n) => !n.read).length;
  const unreadCount =
    isSuccess && notifications.length < LIST_LIMIT ? listUnreadCount : Math.max(serverUnreadCount, listUnreadCount);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const triggerLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={triggerLabel} title="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-1.5rem)] max-w-sm p-0"
        align="end"
        collisionPadding={12}
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => {
                const unread = !notification.read;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        unread && "bg-primary/5",
                      )}
                    >
                      {unread && (
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
                      )}
                      <span className="mt-0.5 shrink-0">{typeIcon(notification.type)}</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            unread ? "font-semibold text-foreground" : "font-normal text-muted-foreground",
                          )}
                        >
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </span>
                      {unread && (
                        <>
                          <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <span className="sr-only">(unread)</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
