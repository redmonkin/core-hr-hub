import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employee: {
    name: string;
    email: string;
    avatar?: string;
  };
  month: string;
  monthNum: number;
  year: number;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "pending" | "processing" | "paid";
  paidAt?: string;
  ltaAllowance: number;
  variablePay: number;
  pfEmployerContribution: number;
  healthInsurance: number;
  professionalTax: number;
  tds: number;
  advanceAmountAdjusted: number;
  lossOfPayDays: number;
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
          employee_id,
          month,
          year,
          basic_salary,
          total_allowances,
          total_deductions,
          net_salary,
          status,
          paid_at,
          lta_allowance,
          variable_pay,
          pf_employer_contribution,
          health_insurance,
          professional_tax,
          tds,
          advance_amount_adjusted,
          loss_of_pay_days,
          employee:employees(
            first_name,
            last_name,
            email,
            avatar_url,
            employee_code
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
        employeeId: record.employee_id,
        employeeCode: record.employee?.employee_code || "",
        employee: {
          name: `${record.employee?.first_name} ${record.employee?.last_name}`,
          email: record.employee?.email || "",
          avatar: record.employee?.avatar_url || undefined,
        },
        month: `${MONTH_NAMES[record.month - 1]} ${record.year}`,
        monthNum: record.month,
        year: record.year,
        basic: Number(record.basic_salary),
        allowances: Number(record.total_allowances),
        deductions: Number(record.total_deductions),
        netSalary: Number(record.net_salary),
        status: record.status === "draft" ? "pending" : record.status === "processed" ? "processing" : "paid",
        paidAt: record.paid_at ? format(new Date(record.paid_at), "MMM d, yyyy") : undefined,
        ltaAllowance: Number(record.lta_allowance || 0),
        variablePay: Number(record.variable_pay || 0),
        pfEmployerContribution: Number(record.pf_employer_contribution || 0),
        healthInsurance: Number(record.health_insurance || 0),
        professionalTax: Number(record.professional_tax || 0),
        tds: Number(record.tds || 0),
        advanceAmountAdjusted: Number(record.advance_amount_adjusted || 0),
        lossOfPayDays: Number(record.loss_of_pay_days || 0),
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

/** Expands holiday rows (possibly multi-day) into a set of "yyyy-MM-dd" strings, clipped to [monthStart, monthEnd]. */
function buildHolidaySet(
  holidays: { event_date: string; end_date: string | null }[],
  monthStart: Date,
  monthEnd: Date
): Set<string> {
  const set = new Set<string>();
  holidays.forEach((h) => {
    const hStart = new Date(`${h.event_date}T00:00:00`);
    const hEnd = h.end_date ? new Date(`${h.end_date}T00:00:00`) : hStart;
    const rangeStart = hStart < monthStart ? monthStart : hStart;
    const rangeEnd = hEnd > monthEnd ? monthEnd : hEnd;
    if (rangeStart > rangeEnd) return;
    for (const cur = new Date(rangeStart); cur <= rangeEnd; cur.setDate(cur.getDate() + 1)) {
      set.add(format(cur, "yyyy-MM-dd"));
    }
  });
  return set;
}

/** Counts days in [start, end] (inclusive) that fall on one of workingDays and aren't a holiday. */
function countWorkingDays(start: Date, end: Date, workingDays: number[], holidaySet: Set<string>): number {
  let count = 0;
  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (workingDays.includes(cur.getDay()) && !holidaySet.has(format(cur, "yyyy-MM-dd"))) {
      count++;
    }
  }
  return count;
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

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");

      // Get all salary structures with the employee's hire date and working days,
      // so we can skip employees who joined after this month and pro-rate mid-month joiners.
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
          pf_deduction,
          employee:employees(hire_date, working_days)
        `);

      if (salaryError) throw salaryError;

      if (!salaryStructures || salaryStructures.length === 0) {
        throw new Error("No salary structures found. Please set up salary structures for employees first.");
      }

      // Exclude employees who joined after the selected month
      const eligible = salaryStructures.filter((s) => {
        const hireDate = s.employee?.hire_date;
        return !hireDate || hireDate <= monthEndStr;
      });

      if (eligible.length === 0) {
        throw new Error("No employees were active during the selected month.");
      }

      // Holidays overlapping the selected month, for working-day proration
      const { data: holidays } = await supabase
        .from("company_events")
        .select("event_date, end_date")
        .eq("is_holiday", true)
        .lte("event_date", monthEndStr);

      const holidaySet = buildHolidaySet(holidays || [], monthStart, monthEnd);

      // Generate payroll records, pro-rating basic/allowances/deductions for
      // employees whose hire date falls inside the selected month
      const payrollRecords = eligible.map((salary) => {
        const totalAllowances =
          Number(salary.hra || 0) +
          Number(salary.transport_allowance || 0) +
          Number(salary.medical_allowance || 0) +
          Number(salary.other_allowances || 0);

        const totalDeductions =
          Number(salary.tax_deduction || 0) +
          Number(salary.pf_deduction || 0);

        const workingDays =
          salary.employee?.working_days && salary.employee.working_days.length > 0
            ? salary.employee.working_days
            : [1, 2, 3, 4, 5];

        const hireDate = salary.employee?.hire_date ? new Date(`${salary.employee.hire_date}T00:00:00`) : null;

        let ratio = 1;
        if (hireDate && hireDate > monthStart) {
          const totalWorkingDaysInMonth = countWorkingDays(monthStart, monthEnd, workingDays, holidaySet);
          const workedDays = countWorkingDays(hireDate, monthEnd, workingDays, holidaySet);
          ratio = totalWorkingDaysInMonth > 0 ? workedDays / totalWorkingDaysInMonth : 1;
        }

        const basicSalary = Number(salary.basic_salary) * ratio;
        const proratedAllowances = totalAllowances * ratio;
        const proratedDeductions = totalDeductions * ratio;
        const netSalary = basicSalary + proratedAllowances - proratedDeductions;

        return {
          employee_id: salary.employee_id,
          month,
          year,
          basic_salary: basicSalary,
          total_allowances: proratedAllowances,
          total_deductions: proratedDeductions,
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
    onError: (error) => {
      toast.error("Failed to generate payroll: " + error.message);
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
    onError: (error) => {
      toast.error("Failed to update payroll status: " + error.message);
    },
  });
}

export interface PayrollDetailsInput {
  id: string;
  employeeId: string;
  basicSalary: number;
  ltaAllowance: number;
  variablePay: number;
  pfEmployerContribution: number;
  healthInsurance: number;
  professionalTax: number;
  tds: number;
  advanceAmountAdjusted: number;
  lossOfPayDays: number;
}

export function useUpdatePayrollDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PayrollDetailsInput) => {
      const { data: salaryStructure, error: salaryError } = await supabase
        .from("salary_structures")
        .select("hra, transport_allowance, medical_allowance, other_allowances, pf_deduction")
        .eq("employee_id", data.employeeId)
        .maybeSingle();

      if (salaryError) throw salaryError;

      const hra = Number(salaryStructure?.hra || 0);
      const otherAllowanceBucket =
        Number(salaryStructure?.transport_allowance || 0) +
        Number(salaryStructure?.medical_allowance || 0) +
        Number(salaryStructure?.other_allowances || 0);
      const pfEmployeeDeduction = Number(salaryStructure?.pf_deduction || 0);

      const totalGrossSalary =
        data.basicSalary + hra + otherAllowanceBucket + data.ltaAllowance + data.variablePay;
      const totalDeductions =
        pfEmployeeDeduction + data.professionalTax + data.tds + data.advanceAmountAdjusted;
      const netSalary = totalGrossSalary - totalDeductions;

      const { error } = await supabase
        .from("payroll_records")
        .update({
          lta_allowance: data.ltaAllowance,
          variable_pay: data.variablePay,
          pf_employer_contribution: data.pfEmployerContribution,
          health_insurance: data.healthInsurance,
          professional_tax: data.professionalTax,
          tds: data.tds,
          advance_amount_adjusted: data.advanceAmountAdjusted,
          loss_of_pay_days: data.lossOfPayDays,
          total_allowances: hra + otherAllowanceBucket + data.ltaAllowance + data.variablePay,
          total_deductions: totalDeductions,
          net_salary: netSalary,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-stats"] });
    },
    onError: (error) => {
      toast.error("Failed to update payroll details: " + error.message);
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
    onError: (error) => {
      toast.error("Failed to update payroll status: " + error.message);
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
  pfDeduction: number;
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
          pf_deduction,
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
          Number(structure.pf_deduction || 0);

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
          pfDeduction: Number(structure.pf_deduction || 0),
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
  pf_deduction?: number;
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
    onError: (error) => {
      toast.error("Failed to save salary structure: " + error.message);
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
    onError: (error) => {
      toast.error("Failed to update salary structure: " + error.message);
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
    onError: (error) => {
      toast.error("Failed to delete salary structure: " + error.message);
    },
  });
}
