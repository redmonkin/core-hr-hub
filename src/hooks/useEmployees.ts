import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  avatar?: string;
  department: string;
  designation: string;
  joinDate: string;
  status: "active" | "inactive" | "onboarding" | "offboarded";
}

export interface EmployeeWithDetails {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  designation: string;
  hire_date: string;
  status: string;
  avatar_url: string | null;
  department: { name: string } | null;
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          employee_code,
          first_name,
          last_name,
          email,
          phone,
          designation,
          hire_date,
          status,
          avatar_url,
          department:departments!employees_department_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to match the Employee interface
      return (data || []).map((emp): Employee => ({
        id: emp.id,
        employeeCode: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
        avatar: emp.avatar_url || undefined,
        department: emp.department?.name || "Unassigned",
        designation: emp.designation,
        joinDate: format(new Date(emp.hire_date), "MMM d, yyyy"),
        status: emp.status as Employee["status"],
      }));
    },
  });
}

export function useEmployeeStats() {
  return useQuery({
    queryKey: ["employee-stats"],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employees")
        .select("id, status");

      if (error) throw error;

      const total = employees?.length || 0;
      const active = employees?.filter((e) => e.status === "active").length || 0;
      const onboarding = employees?.filter((e) => e.status === "onboarding").length || 0;

      return { total, active, onboarding };
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, description")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
}

export function useBulkDeleteEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeIds: string[]) => {
      // Delete in sequence to handle any cascading properly
      const errors: string[] = [];
      
      for (const id of employeeIds) {
        const { error } = await supabase
          .from("employees")
          .delete()
          .eq("id", id);
        
        if (error) {
          errors.push(`Failed to delete employee ${id}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      return { deletedCount: employeeIds.length };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-stats"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}

export function useBulkUpdateEmployeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeIds, status }: { employeeIds: string[]; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("employees")
        .update({ status })
        .in("id", employeeIds);
      
      if (error) {
        throw new Error(`Failed to update employee status: ${error.message}`);
      }

      return { updatedCount: employeeIds.length, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-stats"] });
    },
  });
}
