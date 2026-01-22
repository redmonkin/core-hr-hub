import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee: {
    name: string;
    avatar?: string;
    department: string;
  };
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
}

export function useLeaveRequests() {
  return useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          reason,
          status,
          employee_id,
          created_at,
          leave_type:leave_types(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch employee details separately to avoid the multiple relationship issue
      const employeeIds = [...new Set((data || []).map((r) => r.employee_id))];
      
      const { data: employees } = await supabase
        .from("employees")
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          department:departments!employees_department_id_fkey(name)
        `)
        .in("id", employeeIds);

      const employeeMap = new Map(
        (employees || []).map((e) => [e.id, e])
      );

      return (data || []).map((req): LeaveRequest => {
        const emp = employeeMap.get(req.employee_id);
        return {
          id: req.id,
          employeeId: req.employee_id,
          employee: {
            name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
            avatar: emp?.avatar_url || undefined,
            department: emp?.department?.name || "Unassigned",
          },
          type: req.leave_type?.name || "Unknown",
          startDate: format(new Date(req.start_date), "MMM d, yyyy"),
          endDate: format(new Date(req.end_date), "MMM d, yyyy"),
          days: req.days_count,
          reason: req.reason || "",
          status: req.status as LeaveRequest["status"],
          submittedAt: format(new Date(req.created_at), "MMM d, yyyy 'at' h:mm a"),
        };
      });
    },
  });
}

export function useLeaveStats() {
  return useQuery({
    queryKey: ["leave-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, status");

      if (error) throw error;

      const pending = data?.filter((r) => r.status === "pending").length || 0;
      const approved = data?.filter((r) => r.status === "approved").length || 0;
      const rejected = data?.filter((r) => r.status === "rejected").length || 0;

      return { pending, approved, rejected };
    },
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("id, name, days_per_year, is_paid")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateLeaveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ 
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
    },
  });
}
