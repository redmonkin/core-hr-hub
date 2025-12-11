import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  uploaded_at: string;
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as EmployeeDocument[];
    },
    enabled: !!employeeId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      file,
      documentType,
    }: {
      employeeId: string;
      file: File;
      documentType: string;
    }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${employeeId}/${Date.now()}-${file.name}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from("employee_documents")
        .insert({
          employee_id: employeeId,
          document_name: file.name,
          document_type: documentType,
          file_url: fileName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", variables.employeeId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload document: " + error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, fileUrl, employeeId }: { documentId: string; fileUrl: string; employeeId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("employee-documents")
        .remove([fileUrl]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", variables.employeeId] });
      toast.success("Document deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete document: " + error.message);
    },
  });
}
