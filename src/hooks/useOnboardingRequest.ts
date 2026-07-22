import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

export interface OnboardingRequestSubmission {
  phone: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  designation: string;
  joiningDate: string;
  message?: string;
  resume: File;
  offerLetter: File;
  idProof: File;
}

export function useOnboardingRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const requestQuery = useQuery({
    queryKey: ["onboarding-request", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("onboarding_requests")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const uploadOnboardingDocument = async (docType: string, file: File) => {
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error(`${file.name} is too large. Maximum size is 10MB.`);
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      throw new Error(`${file.name} has an unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG.`);
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `${user!.id}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("onboarding-documents")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    return filePath;
  };

  const submitRequest = useMutation({
    mutationFn: async (submission: OnboardingRequestSubmission) => {
      if (!user?.id || !user?.email) throw new Error("User not authenticated");

      // Get user's full name from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const fullName = profile?.full_name || user.email.split("@")[0];

      const [resumeUrl, offerLetterUrl, idProofUrl] = await Promise.all([
        uploadOnboardingDocument("resume", submission.resume),
        uploadOnboardingDocument("offer_letter", submission.offerLetter),
        uploadOnboardingDocument("id_proof", submission.idProof),
      ]);

      const { data, error } = await supabase.from("onboarding_requests").insert({
        user_id: user.id,
        email: user.email,
        full_name: fullName,
        message: submission.message,
        phone: submission.phone,
        address: submission.address,
        date_of_birth: submission.dateOfBirth,
        gender: submission.gender,
        designation: submission.designation,
        joining_date: submission.joiningDate,
        resume_url: resumeUrl,
        offer_letter_url: offerLetterUrl,
        id_proof_url: idProofUrl,
      }).select().single();

      if (error) throw error;

      // Send notification to HR
      try {
        await supabase.functions.invoke("onboarding-request-notification", {
          body: {
            type: "submitted",
            request_id: data.id,
            user_email: user.email,
            user_name: fullName,
            message: submission.message,
          },
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
      }
    },
    onSuccess: () => {
      toast.success("Onboarding request submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-request", user?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });

  return {
    request: requestQuery.data,
    isLoading: requestQuery.isLoading,
    submitRequest,
  };
}
