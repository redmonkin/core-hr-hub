import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type InvitationResult =
  | { success: true; status: "invited"; user_id?: string; sent_at: string }
  | { success: true; status: "linked"; user_id: string }
  | { success: true; status: "cancelled" };

interface InviteErrorBody {
  error?: string;
  details?: { field?: string; message?: string }[];
}

/** Where the invitation link lands: the page where the new hire chooses a password. */
export const inviteRedirectUrl = () => `${window.location.origin}/reset-password?welcome=1`;

async function callInviteFunction(body: Record<string, unknown>): Promise<InvitationResult> {
  const { data, error } = await supabase.functions.invoke("invite-employee", { body });
  if (error) {
    let message = error.message || "The invitation couldn't be sent";
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await (error.context as Response).json()) as InviteErrorBody;
        if (payload?.error) {
          const details = (payload.details ?? []).map((d) => d.message).filter(Boolean).join("; ");
          message = details ? `${payload.error}: ${details}` : payload.error;
        }
      } catch {
        // body wasn't JSON; keep the generic message
      }
    }
    throw new Error(message);
  }
  const result = (data ?? {}) as InvitationResult & InviteErrorBody;
  if (result.error) throw new Error(result.error);
  return result;
}

/**
 * Email the employee a link to set up their account (or a fresh link, if one
 * was sent before). If the address already has a working account, the
 * employee record is linked to it and nothing is sent ("linked").
 */
export const sendInvitation = (employeeId: string) =>
  callInviteFunction({ action: "invite", employee_id: employeeId, redirect_url: inviteRedirectUrl() });

/** Revoke the invitation; links already emailed stop working. The employee record stays. */
export const cancelInvitation = (employeeId: string) =>
  callInviteFunction({ action: "cancel", employee_id: employeeId });
