import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type ReimbursementStatusValue = Database["public"]["Enums"]["reimbursement_status"];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "other", label: "Other" },
];

export interface ReimbursementRequest {
  id: string;
  employeeId: string;
  employee: {
    name: string;
    avatar?: string;
    department: string;
  };
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl: string;
  status: ReimbursementStatusValue;
  submittedAt: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  reviewNotes?: string;
  paidAt?: string;
  paidBy?: { name: string };
}

const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_RECEIPT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

export function useSubmitReimbursement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      category,
      amount,
      expenseDate,
      description,
      receipt,
    }: {
      employeeId: string;
      category: ExpenseCategory;
      amount: number;
      expenseDate: string;
      description: string;
      receipt: File;
    }) => {
      if (receipt.size > MAX_RECEIPT_SIZE_BYTES) {
        throw new Error("Receipt file is too large. Maximum size is 10MB.");
      }
      if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
        throw new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG.");
      }

      const sanitizedName = receipt.name
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .replace(/_+/g, "_");
      const fileName = `${employeeId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("reimbursement-receipts")
        .upload(fileName, receipt);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("reimbursement_requests")
        .insert({
          employee_id: employeeId,
          category,
          amount,
          expense_date: expenseDate,
          description: description.trim(),
          receipt_url: fileName,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Notify manager/HR (fire and forget)
      supabase.functions.invoke("reimbursement-submission-notification", {
        body: {
          request_id: data.id,
          employee_id: employeeId,
          category,
          amount,
          expense_date: expenseDate,
          description: description.trim(),
        }
      }).catch((err) => {
        console.error("Failed to send reimbursement submission notification:", err);
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursement-requests"] });
      toast.success("Reimbursement request submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit reimbursement request: " + error.message);
    },
  });
}

export function useReimbursementRequests() {
  return useQuery({
    queryKey: ["reimbursement-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursement_requests")
        .select(`
          id,
          employee_id,
          category,
          amount,
          expense_date,
          description,
          receipt_url,
          status,
          created_at,
          reviewed_by,
          reviewed_at,
          review_notes,
          paid_at,
          paid_by
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const employeeIds = [...new Set((data || []).map((r) => r.employee_id))];
      const reviewerIds = [...new Set((data || []).filter((r) => r.reviewed_by).map((r) => r.reviewed_by))];
      const paidByIds = [...new Set((data || []).filter((r) => r.paid_by).map((r) => r.paid_by))];
      const allEmployeeIds = [...new Set([...employeeIds, ...reviewerIds, ...paidByIds])];

      const { data: employees } = await supabase
        .from("employees")
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          department:departments!employees_department_id_fkey(name)
        `)
        .in("id", allEmployeeIds);

      const employeeMap = new Map((employees || []).map((e) => [e.id, e]));

      return (data || []).map((req): ReimbursementRequest => {
        const emp = employeeMap.get(req.employee_id);
        const reviewer = req.reviewed_by ? employeeMap.get(req.reviewed_by) : null;
        const payer = req.paid_by ? employeeMap.get(req.paid_by) : null;
        return {
          id: req.id,
          employeeId: req.employee_id,
          employee: {
            name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
            avatar: emp?.avatar_url || undefined,
            department: emp?.department?.name || "Unassigned",
          },
          category: req.category,
          amount: req.amount,
          expenseDate: format(new Date(req.expense_date), "MMM d, yyyy"),
          description: req.description,
          receiptUrl: req.receipt_url,
          status: req.status,
          submittedAt: format(new Date(req.created_at), "MMM d, yyyy 'at' h:mm a"),
          reviewedBy: reviewer ? { name: `${reviewer.first_name} ${reviewer.last_name}` } : undefined,
          reviewedAt: req.reviewed_at ? format(new Date(req.reviewed_at), "MMM d, yyyy 'at' h:mm a") : undefined,
          reviewNotes: req.review_notes || undefined,
          paidAt: req.paid_at ? format(new Date(req.paid_at), "MMM d, yyyy 'at' h:mm a") : undefined,
          paidBy: payer ? { name: `${payer.first_name} ${payer.last_name}` } : undefined,
        };
      });
    },
  });
}

export function useReimbursementStats() {
  return useQuery({
    queryKey: ["reimbursement-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursement_requests")
        .select("id, status, amount");

      if (error) throw error;

      const pending = data?.filter((r) => r.status === "pending").length || 0;
      const approved = data?.filter((r) => r.status === "approved").length || 0;
      const rejected = data?.filter((r) => r.status === "rejected").length || 0;
      const paid = data?.filter((r) => r.status === "paid").length || 0;
      const pendingAmount = data?.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      return { pending, approved, rejected, paid, pendingAmount };
    },
  });
}

export function useUpdateReimbursementStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      reviewerId,
      reviewerName,
      reviewNotes,
    }: {
      requestId: string;
      status: "approved" | "rejected" | "paid";
      reviewerId: string | null;
      reviewerName: string;
      reviewNotes?: string;
    }) => {
      const updatePayload =
        status === "paid"
          ? { status, paid_at: new Date().toISOString(), paid_by: reviewerId }
          : {
              status,
              review_notes: reviewNotes?.trim() || null,
              reviewed_by: reviewerId,
              reviewed_at: new Date().toISOString(),
            };

      const { error } = await supabase
        .from("reimbursement_requests")
        .update(updatePayload)
        .eq("id", requestId);

      if (error) throw error;

      supabase.functions.invoke("reimbursement-status-notification", {
        body: {
          request_id: requestId,
          status,
          reviewer_name: reviewerName,
          review_notes: reviewNotes?.trim() || undefined,
        }
      }).catch((err) => {
        console.error("Failed to send reimbursement status notification:", err);
      });

      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursement-requests"] });
      queryClient.invalidateQueries({ queryKey: ["reimbursement-stats"] });
    },
    onError: (error) => {
      toast.error("Failed to update reimbursement request: " + error.message);
    },
  });
}

/**
 * Approve, reject or mark several claims paid at once. RLS and the guard
 * trigger still decide per claim (a manager only reaches their own team), so
 * the result says how many were actually updated. Each employee gets their
 * usual email.
 */
export function useBulkUpdateReimbursementStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestIds,
      status,
      reviewerId,
      reviewNotes,
    }: {
      requestIds: string[];
      status: "approved" | "rejected" | "paid";
      reviewerId: string | null;
      reviewNotes?: string;
    }) => {
      const now = new Date().toISOString();
      const updatePayload =
        status === "paid"
          ? { status, paid_at: now, paid_by: reviewerId }
          : { status, review_notes: reviewNotes?.trim() || null, reviewed_by: reviewerId, reviewed_at: now };
      const fromStatus = status === "paid" ? "approved" : "pending";

      const { data, error } = await supabase
        .from("reimbursement_requests")
        .update(updatePayload)
        .in("id", requestIds)
        .eq("status", fromStatus)
        .select("id");

      if (error) throw error;
      const updatedIds = (data ?? []).map((row) => row.id);

      // One email per claim, a few at a time so a long list doesn't flood the function
      for (let i = 0; i < updatedIds.length; i += 5) {
        await Promise.allSettled(
          updatedIds.slice(i, i + 5).map((id) =>
            supabase.functions.invoke("reimbursement-status-notification", { body: { request_id: id } }),
          ),
        );
      }

      return { updated: updatedIds.length, skipped: requestIds.length - updatedIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursement-requests"] });
      queryClient.invalidateQueries({ queryKey: ["reimbursement-stats"] });
    },
    onError: (error) => {
      toast.error("Failed to update reimbursement requests: " + error.message);
    },
  });
}
