import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LeaveCalendar } from "@/components/dashboard/LeaveCalendar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { PerformanceWidget } from "@/components/dashboard/PerformanceWidget";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";
import { TeamLeaveCalendar } from "@/components/dashboard/TeamLeaveCalendar";
import { NonEmployeeDashboard } from "@/components/dashboard/NonEmployeeDashboard";
import { UpdateNotification } from "@/components/dashboard/UpdateNotification";
import { WhosOut } from "@/components/dashboard/WhosOut";
import { Users, Calendar, Package, CreditCard, ClipboardCheck, CalendarDays } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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

        {/* Greeting */}
        <h1 className="text-2xl font-semibold text-foreground">
          {getGreeting()}, {getUserFirstName()}
        </h1>

        {/* Stats Grid */}
        <div className={`grid gap-4 sm:grid-cols-2 ${isAdminOrHR ? (hasPendingApprovals ? 'lg:grid-cols-5' : 'lg:grid-cols-4') : (hasPendingApprovals ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}`}>
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </>
          ) : (
            <>
              {/* Admin/HR only stats */}
              {isAdminOrHR && (
                <>
                  <StatsCard
                    title="Total Employees"
                    value={String(stats?.totalEmployees || 0)}
                    icon={<Users className="h-6 w-6" />}
                    variant="primary"
                  />
                  <StatsCard
                    title="On Leave Today"
                    value={String(stats?.onLeaveToday || 0)}
                    icon={<Calendar className="h-6 w-6" />}
                    variant="warning"
                  />
                  <StatsCard
                    title="Assets Assigned"
                    value={String(stats?.assetsAssigned || 0)}
                    icon={<Package className="h-6 w-6" />}
                    variant="success"
                  />
                  <StatsCard
                    title="Pending Payroll"
                    value={formatCurrency(stats?.pendingPayroll || 0)}
                    icon={<CreditCard className="h-6 w-6" />}
                    variant="default"
                  />
                </>
              )}
              
              {/* Employee-specific stats */}
              {!isAdminOrHR && (
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
                </>
              )}
              
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

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <WhosOut />
            <PendingApprovalsWidget />
            <TeamLeaveCalendar />
            <QuickActions />
            <PerformanceWidget />
            <LeaveCalendar />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;