import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  employee_count: number;
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data: departments, error } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      // Get employee counts per department
      const { data: employees } = await supabase
        .from("employees")
        .select("department_id")
        .not("department_id", "is", null);

      const countMap = new Map<string, number>();
      employees?.forEach((emp) => {
        if (emp.department_id) {
          countMap.set(emp.department_id, (countMap.get(emp.department_id) || 0) + 1);
        }
      });

      return (departments || []).map((dept) => ({
        ...dept,
        employee_count: countMap.get(dept.id) || 0,
      })) as Department[];
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (department: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("departments")
        .insert(department)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...department }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("departments")
        .update(department)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}
