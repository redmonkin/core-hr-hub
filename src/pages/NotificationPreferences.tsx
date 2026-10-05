import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle";
import { toast } from "sonner";
import { Bell, Mail, Calendar, FileCheck, Target, UserPlus, PartyPopper, Clock } from "lucide-react";

const NotificationPreferences = () => {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      toast.success("Preferences updated");
    } catch (error) {
      toast.error("Failed to update preferences");
    }
  };

  const notificationTypes = [
    {
      key: "event_notifications",
      label: "Company events",
      description: "Get notified about upcoming company events and meetings",
      icon: Calendar,
    },
    {
      key: "holiday_notifications",
      label: "Holidays",
      description: "Receive reminders about upcoming holidays",
      icon: PartyPopper,
    },
    {
      key: "leave_status_notifications",
      label: "Leave status updates",
      description: "Get notified when your leave requests are approved or rejected",
      icon: FileCheck,
    },
    {
      key: "review_notifications",
      label: "Performance reviews",
      description: "Receive notifications about performance review schedules and updates",
      icon: Bell,
    },
    {
      key: "goal_reminder_notifications",
      label: "Goal reminders",
      description: "Get reminders about upcoming goal deadlines",
      icon: Target,
    },
    {
      key: "onboarding_notifications",
      label: "Onboarding updates",
      description: "Receive notifications about onboarding tasks and progress",
      icon: UserPlus,
    },
    {
      key: "attendance_reminder_notifications",
      label: "Attendance reminders",
      description: "Get reminders to clock in and clock out on working days",
      icon: Clock,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notification preferences</h1>
          <p className="text-muted-foreground">
            Choose how and when Peoplo notifies you — on this device and by email
          </p>
        </div>

        <PushNotificationToggle />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
              <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
              Email notifications
            </CardTitle>
            <CardDescription>
              Choose which updates are sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-11" />
                </div>
              ))
            ) : (
              notificationTypes.map((type) => {
                const Icon = type.icon;
                const isEnabled = preferences?.[type.key as keyof typeof preferences] as boolean;
                
                return (
                  <div
                    key={type.key}
                    className="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-0 last:pb-0"
                  >
                    <div className="grid min-w-0 grid-cols-[1.25rem_1fr] items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 space-y-0.5">
                        <Label htmlFor={type.key} className="cursor-pointer text-sm font-medium sm:text-base">
                          {type.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      className="shrink-0"
                      id={type.key}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(type.key, checked)}
                      disabled={updatePreferences.isPending}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default NotificationPreferences;
