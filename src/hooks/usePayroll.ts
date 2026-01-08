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
  paidAt?: string;
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
          paid_at,
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
        paidAt: record.paid_at ? format(new Date(record.paid_at), "MMM d, yyyy") : undefined,
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

export function useUpdatePayrollStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "processed" | "paid" }) => {
      const updateData: { status: "draft" | "processed" | "paid"; paid_at?: string | null } = { status };
      
      // Set paid_at when marking as paid, clear it otherwise
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from("payroll_records")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-stats"] });
    },
  });
}

export function useBulkUpdatePayrollStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "draft" | "processed" | "paid" }) => {
      const updateData: { status: "draft" | "processed" | "paid"; paid_at?: string | null } = { status };
      
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from("payroll_records")
        .update(updateData)
        .in("id", ids);

      if (error) throw error;
      
      return { count: ids.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-stats"] });
    },
  });
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeAvatar?: string;
  basicSalary: number;
  hra: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  taxDeduction: number;
  otherDeductions: number;
  effectiveFrom: string;
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
}

export function useSalaryStructures() {
  return useQuery({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_structures")
        .select(`
          id,
          employee_id,
          basic_salary,
          hra,
          transport_allowance,
          medical_allowance,
          other_allowances,
          tax_deduction,
          other_deductions,
          effective_from,
          employee:employees(
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((structure): SalaryStructure => {
        const totalAllowances =
          Number(structure.hra || 0) +
          Number(structure.transport_allowance || 0) +
          Number(structure.medical_allowance || 0) +
          Number(structure.other_allowances || 0);

        const totalDeductions =
          Number(structure.tax_deduction || 0) +
          Number(structure.other_deductions || 0);

        const netSalary =
          Number(structure.basic_salary) + totalAllowances - totalDeductions;

        return {
          id: structure.id,
          employeeId: structure.employee_id,
          employeeName: `${structure.employee?.first_name} ${structure.employee?.last_name}`,
          employeeEmail: structure.employee?.email || "",
          employeeAvatar: structure.employee?.avatar_url || undefined,
          basicSalary: Number(structure.basic_salary),
          hra: Number(structure.hra || 0),
          transportAllowance: Number(structure.transport_allowance || 0),
          medicalAllowance: Number(structure.medical_allowance || 0),
          otherAllowances: Number(structure.other_allowances || 0),
          taxDeduction: Number(structure.tax_deduction || 0),
          otherDeductions: Number(structure.other_deductions || 0),
          effectiveFrom: structure.effective_from,
          totalAllowances,
          totalDeductions,
          netSalary,
        };
      });
    },
  });
}

export interface CreateSalaryStructureData {
  employee_id: string;
  basic_salary: number;
  hra?: number;
  transport_allowance?: number;
  medical_allowance?: number;
  other_allowances?: number;
  tax_deduction?: number;
  other_deductions?: number;
  effective_from: string;
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSalaryStructureData) => {
      const { error } = await supabase
        .from("salary_structures")
        .upsert(data, { onConflict: "employee_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    },
  });
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateSalaryStructureData>) => {
      const { error } = await supabase
        .from("salary_structures")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    },
  });
}

export function useDeleteSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("salary_structures")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    },
  });
}
