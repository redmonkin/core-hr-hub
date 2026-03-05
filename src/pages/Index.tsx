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
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: employeeStatus, isLoading: isEmployeeStatusLoading } = useEmployeeStatus();
  const { isAdminOrHR, isLoading: isRoleLoading } = useIsAdminOrHR();
  const { user } = useAuth();
  const navigate = useNavigate();
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show non-employee dashboard if user is not an employee and not admin/HR
  if (!employeeStatus?.isEmployee && !isAdminOrHR) {
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            {getGreeting()}, {getUserFirstName()}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="h-4 w-4" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
              {isAdminOrHR ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/onboarding" className="flex items-center gap-2 cursor-pointer">
                      <UserPlus className="h-4 w-4" /> Add Employee
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/assets" className="flex items-center gap-2 cursor-pointer">
                      <Package className="h-4 w-4" /> Manage Assets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/payroll" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" /> View Payroll
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/leaves" className="flex items-center gap-2 cursor-pointer">
                      <Calendar className="h-4 w-4" /> Request Leave
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/performance" className="flex items-center gap-2 cursor-pointer">
                      <Target className="h-4 w-4" /> My KPIs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/attendance" className="flex items-center gap-2 cursor-pointer">
                      <ClipboardList className="h-4 w-4" /> View Attendance
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Grid */}
        <div className={`grid gap-4 sm:grid-cols-2 ${hasPendingApprovals ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </>
          ) : (
            <>
              <StatsCard
                title="Leave Balance"
                value={`${stats?.availableLeaves || 0} / ${stats?.totalLeaves || 0}`}
                icon={<CalendarDays className="h-6 w-6" />}
                variant="primary"
              />
              <StatsCard
                title={stats?.onLeaveToday ? "You're On Leave" : "Status Today"}
                value={stats?.onLeaveToday ? "On Leave" : "Working"}
                icon={<Calendar className="h-6 w-6" />}
                variant={stats?.onLeaveToday ? "warning" : "success"}
              />
              <StatsCard
                title="My Assets"
                value={String(stats?.assetsAssigned || 0)}
                icon={<Package className="h-6 w-6" />}
                variant="success"
              />
              
              {hasPendingApprovals && (
                <div 
                  className="cursor-pointer" 
                  onClick={() => navigate("/leave-approvals")}
                >
                  <StatsCard
                    title="Pending Approvals"
                    value={String(stats?.pendingApprovals || 0)}
                    icon={<ClipboardCheck className="h-6 w-6" />}
                    variant="warning"
                  />
                </div>
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