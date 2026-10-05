import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, endOfDay } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

type EmployeeRow = { id: string; hire_date: string; status: string; updated_at: string; exit_date: string | null };

/** The day someone left: their last working day (older records fall back to when they were offboarded). */
function leftOn(emp: EmployeeRow): Date {
  return emp.exit_date ? endOfDay(parseISO(emp.exit_date)) : new Date(emp.updated_at);
}

/**
 * Headcount everywhere on the Reports page means "active employees":
 * someone counts at a given date if they had joined by then and are still active,
 * or left after that date. Onboarding (not yet joined) employees are not counted, so the summary, growth chart and department split agree.
 */
function wasEmployedAt(emp: EmployeeRow, date: Date) {
  if (parseISO(emp.hire_date) > date) return false;
  if (emp.status === "active") return true;
  if (emp.status === "offboarded") return leftOn(emp) > date;
  return false;
}

/** Joined (hire date reached) within [start, end], capped at today so future joiners aren't counted yet. */
function joinedBetween(emp: EmployeeRow, start: Date, end: Date) {
  const hire = parseISO(emp.hire_date);
  const cap = end < new Date() ? end : new Date();
  return hire >= start && hire <= cap;
}

function leftBetween(emp: EmployeeRow, start: Date, end: Date) {
  if (emp.status !== "offboarded") return false;
  const left = leftOn(emp);
  return left >= start && left <= end;
}

export function useEmployeeGrowthData(year: number) {
  return useQuery({
    queryKey: ["employee-growth", year],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employees")
        .select("id, hire_date, status, updated_at, exit_date")
        .order("hire_date", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const months: { month: string; employees: number | null }[] = [];
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        const monthEnd = endOfMonth(monthDate);

        // Months that haven't started yet have no headcount (the line stops at today).
        if (monthDate > now) {
          months.push({ month: format(monthDate, "MMM"), employees: null });
          continue;
        }

        const asOf = monthEnd < now ? monthEnd : now;
        const count = (employees as EmployeeRow[] | null)?.filter((emp) => wasEmployedAt(emp, asOf)).length || 0;

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
        .select("id, name")
        .order("name");

      if (deptError) throw deptError;

      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("department_id, status")
        .eq("status", "active");

      if (empError) throw empError;

      // Count active employees per department
      const distribution = departments?.map((dept, index) => ({
        name: dept.name,
        value: employees?.filter((emp) => emp.department_id === dept.id).length || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })).filter((dept) => dept.value > 0) || [];

      // Active employees without a (known) department, so the total matches headcount
      const knownIds = new Set(departments?.map((d) => d.id));
      const unassigned = employees?.filter((emp) => !emp.department_id || !knownIds.has(emp.department_id)).length || 0;
      if (unassigned > 0) {
        distribution.push({ name: "Unassigned", value: unassigned, color: "hsl(var(--muted-foreground))" });
      }

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
          const key = lt.name; // full leave type name, used as series label
          const daysCount = leaveRequests?.filter((lr) => {
            const reqDate = parseISO(lr.start_date);
            return lr.leave_type_id === lt.id && 
                   reqDate >= monthStart && 
                   reqDate <= monthEnd;
          }).reduce((sum, lr) => sum + Number(lr.days_count), 0) || 0;

          monthData[key] = daysCount;
        });

        monthlyData.push(monthData);
      }

      // Get unique leave type keys for the chart
      const leaveTypeKeys = Array.from(new Set(leaveTypes?.map((lt) => lt.name) || []));

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

export function useHeadcountSummary(year: number) {
  return useQuery({
    queryKey: ["headcount-summary", year],
    queryFn: async () => {
      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(new Date(year, 0, 1));

      const { data, error } = await supabase
        .from("employees")
        .select("id, hire_date, status, updated_at, exit_date");

      if (error) throw error;
      const employees = (data || []) as EmployeeRow[];

      // People who joined during the selected year (up to today)
      const newHires = employees.filter((emp) => joinedBetween(emp, yearStart, yearEnd)).length;

      // Left during the selected year (by last working day)
      const terminations = employees.filter((emp) => leftBetween(emp, yearStart, yearEnd)).length;

      const netChange = newHires - terminations;

      // Current headcount: active employees (same population as the growth chart and department split)
      const currentHeadcount = employees.filter((emp) => emp.status === "active").length;

      // Headcount just before the year started
      const dayBeforeYear = new Date(yearStart.getTime() - 1);
      const startOfYearHeadcount = employees.filter((emp) => wasEmployedAt(emp, dayBeforeYear)).length;

      const monthlyBreakdown = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = startOfMonth(new Date(year, month, 1));
        const monthEnd = endOfMonth(new Date(year, month, 1));

        const monthlyHires = employees.filter((emp) => joinedBetween(emp, monthStart, monthEnd)).length;
        const monthlyTerminations = employees.filter((emp) => leftBetween(emp, monthStart, monthEnd)).length;

        monthlyBreakdown.push({
          month: format(monthStart, "MMM"),
          hires: monthlyHires,
          terminations: monthlyTerminations,
          net: monthlyHires - monthlyTerminations,
        });
      }

      return {
        newHires,
        terminations,
        netChange,
        currentHeadcount,
        startOfYearHeadcount,
        monthlyBreakdown,
      };
    },
  });
}
