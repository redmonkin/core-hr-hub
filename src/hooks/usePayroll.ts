import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface PayrollRecord {
  id: string;
  employee: {
    name: string;
    email: string;
    avatar?: string;
  };
  month: string;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "pending" | "processing" | "paid";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function usePayrollRecords(month?: number, year?: number) {
  return useQuery({
    queryKey: ["payroll-records", month, year],
    queryFn: async () => {
      let query = supabase
        .from("payroll_records")
        .select(`
          id,
          month,
          year,
          basic_salary,
          total_allowances,
          total_deductions,
          net_salary,
          status,
          employee:employees(
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (month !== undefined) {
        query = query.eq("month", month);
      }
      if (year !== undefined) {
        query = query.eq("year", year);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((record): PayrollRecord => ({
        id: record.id,
        employee: {
          name: `${record.employee?.first_name} ${record.employee?.last_name}`,
          email: record.employee?.email || "",
          avatar: record.employee?.avatar_url || undefined,
        },
        month: `${MONTH_NAMES[record.month - 1]} ${record.year}`,
        basic: Number(record.basic_salary),
        allowances: Number(record.total_allowances),
        deductions: Number(record.total_deductions),
        netSalary: Number(record.net_salary),
        status: record.status === "draft" ? "pending" : record.status === "processed" ? "processing" : "paid",
      }));
    },
  });
}

export function usePayrollStats() {
  return useQuery({
    queryKey: ["payroll-stats"],
    queryFn: async () => {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      const { data: records, error } = await supabase
        .from("payroll_records")
        .select("net_salary, status")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (error) throw error;

      const { data: employees } = await supabase
        .from("employees")
        .select("id")
        .eq("status", "active");

      const totalPayroll = records?.reduce((sum, r) => sum + Number(r.net_salary), 0) || 0;
      const pending = records?.filter((r) => r.status === "draft").length || 0;
      const avgSalary = records?.length ? totalPayroll / records.length : 0;

      return {
        totalPayroll,
        employeeCount: employees?.length || 0,
        avgSalary,
        pending,
      };
    },
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // Check if payroll already exists for this month
      const { data: existingRecords } = await supabase
        .from("payroll_records")
        .select("id")
        .eq("month", month)
        .eq("year", year);

      if (existingRecords && existingRecords.length > 0) {
        throw new Error("Payroll already exists for this month");
      }

      // Get all active employees with their salary structures
      const { data: salaryStructures, error: salaryError } = await supabase
        .from("salary_structures")
        .select(`
          employee_id,
          basic_salary,
          hra,
          transport_allowance,
          medical_allowance,
          other_allowances,
          tax_deduction,
          other_deductions
        `);

      if (salaryError) throw salaryError;

      if (!salaryStructures || salaryStructures.length === 0) {
        throw new Error("No salary structures found. Please set up salary structures for employees first.");
      }

      // Generate payroll records
      const payrollRecords = salaryStructures.map((salary) => {
        const totalAllowances =
          Number(salary.hra || 0) +
          Number(salary.transport_allowance || 0) +
          Number(salary.medical_allowance || 0) +
          Number(salary.other_allowances || 0);

        const totalDeductions =
          Number(salary.tax_deduction || 0) +
          Number(salary.other_deductions || 0);

        const netSalary =
          Number(salary.basic_salary) + totalAllowances - totalDeductions;

        return {
          employee_id: salary.employee_id,
          month,
          year,
          basic_salary: salary.basic_salary,
          total_allowances: totalAllowances,
          total_deductions: totalDeductions,
          net_salary: netSalary,
          status: "draft" as const,
        };
      });

      const { error: insertError } = await supabase
        .from("payroll_records")
        .insert(payrollRecords);

      if (insertError) throw insertError;

      return { count: payrollRecords.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-stats"] });
    },
  });
}
