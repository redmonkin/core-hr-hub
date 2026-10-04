import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface InviteEmployeeBody {
  email: string;
  first_name: string;
  last_name: string;
  designation?: string;
  department_name?: string;
  redirect_url: string;
  mode?: "employee" | "self_onboarding";
}

export interface InviteEmployeeResult {
  success: boolean;
  user_id?: string;
  already_exists?: boolean;
  invitation_id?: string;
  message?: string;
}

interface InviteErrorBody {
  error?: string;
  details?: { field?: string; message?: string }[];
}

/**
 * Call the invite-employee edge function. Throws an Error whose message is the
 * function's own explanation (e.g. "Only email addresses from approved domains
 * can be invited.") rather than the generic "non-2xx status code".
 */
export async function inviteEmployee(body: InviteEmployeeBody): Promise<InviteEmployeeResult> {
  const { data, error } = await supabase.functions.invoke("invite-employee", { body });
  if (error) {
    let message = error.message || "Failed to send invitation";
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await (error.context as Response).json()) as InviteErrorBody;
        if (payload?.error) {
          const details = (payload.details ?? [])
            .map((d) => d.message)
            .filter(Boolean)
            .join("; ");
          message = details ? `${payload.error}: ${details}` : payload.error;
        }
      } catch {
        // body wasn't JSON; keep the generic message
      }
    }
    throw new Error(message);
  }
  const result = (data ?? {}) as InviteEmployeeResult & InviteErrorBody;
  if (result.error) throw new Error(result.error);
  return result;
}
