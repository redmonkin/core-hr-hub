import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";
import { TeamLeaveCalendar } from "@/components/dashboard/TeamLeaveCalendar";
import { NonEmployeeDashboard } from "@/components/dashboard/NonEmployeeDashboard";
import { UpdateNotification } from "@/components/dashboard/UpdateNotification";
import { WhosOut } from "@/components/dashboard/WhosOut";
import { UpcomingCelebrations } from "@/components/dashboard/UpcomingCelebrations";
import { UpcomingHolidays } from "@/components/dashboard/UpcomingHolidays";
import { Calendar, Package, ClipboardCheck, CalendarDays, Zap, UserPlus, FileText, Target, ClipboardList } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: employeeStatus, isLoading: isEmployeeStatusLoading } = useEmployeeStatus();
  const { can, hasAnyModuleAccess, isLoading: isRoleLoading } = usePermissions();
  const canAddEmployees = can("onboarding", "manage");
  const canViewAssets = can("assets", "view");
  const canViewPayroll = can("payroll", "view");
  const showAdminQuickActions = canAddEmployees || canViewAssets || canViewPayroll;
  const { user } = useAuth();
  const hasPendingApprovals = (stats?.pendingApprovals ?? 0) > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getUserFirstName = () => {
    const fullName = user?.user_metadata?.full_name || user?.email || "User";
    return fullName.split(" ")[0];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Show loading state while checking employee status
  if (isEmployeeStatusLoading || isRoleLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl sm:h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Invited users who haven't been onboarded yet (no employee record and no
  // module access) see the onboarding request form instead
  if (!employeeStatus?.isEmployee && !hasAnyModuleAccess) {
    return (
      <DashboardLayout>
        <NonEmployeeDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Update Notification for Admins */}
        <UpdateNotification />

        {/* Greeting + Quick Actions */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-xl font-semibold text-foreground sm:text-2xl">
            {getGreeting()}, {getUserFirstName()}
          </h1>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 w-10 shrink-0 gap-2 p-0 sm:h-9 sm:w-auto sm:px-3" aria-label="Quick Actions" title="Quick actions">
                <Zap className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Quick actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={12} className="w-52 bg-popover z-50">
              {showAdminQuickActions ? (
                <>
                  {canAddEmployees && (
                    <DropdownMenuItem asChild>
                      <Link to="/onboarding" className="flex items-center gap-2 cursor-pointer">
                        <UserPlus className="h-4 w-4" /> Add employee
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canViewAssets && (
                    <DropdownMenuItem asChild>
                      <Link to="/assets" className="flex items-center gap-2 cursor-pointer">
                        <Package className="h-4 w-4" /> Manage assets
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canViewPayroll && (
                    <DropdownMenuItem asChild>
                      <Link to="/payroll" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" /> View payroll
                      </Link>
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/leaves" className="flex items-center gap-2 cursor-pointer">
                      <Calendar className="h-4 w-4" /> Request leave
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/performance" className="flex items-center gap-2 cursor-pointer">
                      <Target className="h-4 w-4" /> My KPIs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/attendance" className="flex items-center gap-2 cursor-pointer">
                      <ClipboardList className="h-4 w-4" /> View attendance
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${hasPendingApprovals ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className={`h-24 rounded-xl sm:h-32 ${i === 3 ? 'col-span-2 lg:col-span-1' : ''}`} />
              ))}
            </>
          ) : (
            <>
              <StatsCard
                title="Leave balance"
                value={`${stats?.availableLeaves || 0} / ${stats?.totalLeaves || 0}`}
                icon={<CalendarDays className="h-6 w-6" />}
                variant="primary"
              />
              {(() => {
                const statusConfig = {
                  leave: { title: "You're on leave", value: "On leave", variant: "warning" as const },
                  holiday: { title: "Today's a holiday", value: "Holiday", variant: "default" as const },
                  day_off: { title: "Status today", value: "Day off", variant: "default" as const },
                  working: { title: "Status today", value: "Working", variant: "success" as const },
                };
                const { title, value, variant } = statusConfig[stats?.todayStatus || "working"];
                return (
                  <StatsCard
                    title={title}
                    value={value}
                    icon={<Calendar className="h-6 w-6" />}
                    variant={variant}
                  />
                );
              })()}
              <StatsCard
                title="My assets"
                value={String(stats?.assetsAssigned || 0)}
                icon={<Package className="h-6 w-6" />}
                variant="success"
                className={hasPendingApprovals ? undefined : "col-span-2 lg:col-span-1"}
              />

              {hasPendingApprovals && (
                <Link
                  to="/leave-approvals"
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${stats?.pendingApprovals || 0} pending approvals — review now`}
                >
                  <StatsCard
                    title="Pending approvals"
                    value={String(stats?.pendingApprovals || 0)}
                    icon={<ClipboardCheck className="h-6 w-6" />}
                    variant="warning"
                  />
                </Link>
              )}
            </>
          )}
        </div>

        {/* Who's Out */}
        <WhosOut />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <UpcomingHolidays />
            <UpcomingCelebrations />
            <PendingApprovalsWidget />
            <TeamLeaveCalendar />
            
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;