import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LeaveCalendar } from "@/components/dashboard/LeaveCalendar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { PerformanceWidget } from "@/components/dashboard/PerformanceWidget";
import { Users, Calendar, Package, CreditCard } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data: stats, isLoading } = useDashboardStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </>
          ) : (
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
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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