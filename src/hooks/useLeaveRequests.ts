import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  days_per_year: number;
  is_paid: boolean | null;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as LeaveType[];
    },
  });
}

export function useSubmitLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      leaveTypeId,
      leaveTypeName,
      startDate,
      endDate,
      reason,
    }: {
      employeeId: string;
      leaveTypeId: string;
      leaveTypeName: string;
      startDate: Date;
      endDate: Date;
      reason: string;
    }) => {
      // Calculate days count (inclusive)
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          start_date: startDateStr,
          end_date: endDateStr,
          days_count: daysCount,
          reason: reason.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Notify manager (fire and forget)
      supabase.functions.invoke("leave-submission-notification", {
        body: {
          request_id: data.id,
          employee_id: employeeId,
          leave_type: leaveTypeName,
          start_date: startDateStr,
          end_date: endDateStr,
          days_count: daysCount,
          reason: reason.trim() || undefined,
        }
      }).catch(err => {
        console.error("Failed to send leave submission notification:", err);
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success("Leave request submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit leave request: " + error.message);
    },
  });
}
