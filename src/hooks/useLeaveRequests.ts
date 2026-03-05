import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, isWeekend } from "date-fns";
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
      // Calculate business days count (excluding weekends)
      const daysCount = eachDayOfInterval({ start: startDate, end: endDate })
        .filter((d) => !isWeekend(d)).length;

      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      const startDateStr = formatLocalDate(startDate);
      const endDateStr = formatLocalDate(endDate);

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
