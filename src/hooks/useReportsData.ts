import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

export function useEmployeeGrowthData(year: number) {
  return useQuery({
    queryKey: ["employee-growth", year],
    queryFn: async () => {
      // Get all employees with their hire dates
      const { data: employees, error } = await supabase
        .from("employees")
        .select("id, hire_date, status")
        .order("hire_date", { ascending: true });

      if (error) throw error;

      // Calculate cumulative employee count for each month
      const months = [];
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        const monthEnd = endOfMonth(monthDate);
        
        // Count employees hired on or before this month end
        const count = employees?.filter((emp) => {
          const hireDate = new Date(emp.hire_date);
          return hireDate <= monthEnd && emp.status !== "offboarded";
        }).length || 0;

        months.push({
          month: format(monthDate, "MMM"),
          employees: count,
        });
      }

      return months;
    },
  });
}

export function useDepartmentDistribution() {
  return useQuery({
    queryKey: ["department-distribution"],
    queryFn: async () => {
      const { data: departments, error: deptError } = await supabase
        .from("departments")
        .select("id, name");

      if (deptError) throw deptError;

      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("department_id, status")
        .eq("status", "active");

      if (empError) throw empError;

      // Count employees per department
      const distribution = departments?.map((dept, index) => ({
        name: dept.name,
        value: employees?.filter((emp) => emp.department_id === dept.id).length || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })).filter((dept) => dept.value > 0) || [];

      return distribution;
    },
  });
}

export function useLeaveStatistics(year: number) {
  return useQuery({
    queryKey: ["leave-statistics", year],
    queryFn: async () => {
      // Get leave types
      const { data: leaveTypes, error: ltError } = await supabase
        .from("leave_types")
        .select("id, name");

      if (ltError) throw ltError;

      // Get approved leave requests for the year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data: leaveRequests, error: lrError } = await supabase
        .from("leave_requests")
        .select("start_date, days_count, leave_type_id")
        .eq("status", "approved")
        .gte("start_date", startDate)
        .lte("start_date", endDate);

      if (lrError) throw lrError;

      // Aggregate by month and leave type
      const monthlyData = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = endOfMonth(monthStart);
        
        const monthData: Record<string, number | string> = {
          month: format(monthStart, "MMM"),
        };

        leaveTypes?.forEach((lt) => {
          const key = lt.name.toLowerCase().split(" ")[0]; // e.g., "Annual" -> "annual"
          const daysCount = leaveRequests?.filter((lr) => {
            const reqDate = new Date(lr.start_date);
            return lr.leave_type_id === lt.id && 
                   reqDate >= monthStart && 
                   reqDate <= monthEnd;
          }).reduce((sum, lr) => sum + lr.days_count, 0) || 0;

          monthData[key] = daysCount;
        });

        monthlyData.push(monthData);
      }

      // Get unique leave type keys for the chart
      const leaveTypeKeys = leaveTypes?.map((lt) => 
        lt.name.toLowerCase().split(" ")[0]
      ) || [];

      return { monthlyData, leaveTypeKeys };
    },
  });
}

export function usePayrollTrend(year: number) {
  return useQuery({
    queryKey: ["payroll-trend", year],
    queryFn: async () => {
      const { data: payrollRecords, error } = await supabase
        .from("payroll_records")
        .select("month, year, net_salary")
        .eq("year", year)
        .order("month", { ascending: true });

      if (error) throw error;

      // Aggregate by month
      const monthlyData = [];
      for (let month = 1; month <= 12; month++) {
        const monthRecords = payrollRecords?.filter((r) => r.month === month) || [];
        const totalAmount = monthRecords.reduce((sum, r) => sum + Number(r.net_salary), 0);

        if (totalAmount > 0) {
          monthlyData.push({
            month: format(new Date(year, month - 1, 1), "MMM"),
            amount: totalAmount,
          });
        }
      }

      return monthlyData;
    },
  });
}
