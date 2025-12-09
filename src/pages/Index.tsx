import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LeaveCalendar } from "@/components/dashboard/LeaveCalendar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Users, Calendar, Package, CreditCard } from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Employees"
            value="248"
            change={{ value: 12, type: "increase" }}
            icon={<Users className="h-6 w-6" />}
            variant="primary"
          />
          <StatsCard
            title="On Leave Today"
            value="12"
            change={{ value: 3, type: "decrease" }}
            icon={<Calendar className="h-6 w-6" />}
            variant="warning"
          />
          <StatsCard
            title="Assets Assigned"
            value="186"
            change={{ value: 8, type: "increase" }}
            icon={<Package className="h-6 w-6" />}
            variant="success"
          />
          <StatsCard
            title="Pending Payroll"
            value="$124,500"
            icon={<CreditCard className="h-6 w-6" />}
            variant="default"
          />
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
            <LeaveCalendar />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
