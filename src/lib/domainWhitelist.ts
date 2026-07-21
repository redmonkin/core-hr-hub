import { supabase } from "@/integrations/supabase/client";

interface DomainWhitelistSetting {
  enabled: boolean;
  domains: string[];
}

export interface DomainCheckResult {
  allowed: boolean;
  message?: string;
}

/**
 * Checks an email's domain against the organization's domain whitelist
 * setting (organization_settings.domain_whitelist). If the setting is
 * missing, disabled, or fails to load, the email is allowed — the
 * whitelist is an opt-in restriction, not a hard requirement.
 */
export async function checkEmailDomainAllowed(email: string): Promise<DomainCheckResult> {
  try {
    const { data: settings } = await supabase
      .from("organization_settings")
      .select("setting_value")
      .eq("setting_key", "domain_whitelist")
      .maybeSingle();

    const whitelist = settings?.setting_value as unknown as DomainWhitelistSetting | undefined;
    if (!whitelist?.enabled || whitelist.domains.length === 0) {
      return { allowed: true };
    }

    const emailDomain = email.split("@")[1]?.toLowerCase();
    const isAllowed = whitelist.domains.some((domain) => emailDomain === domain.toLowerCase());

    if (!isAllowed) {
      return {
        allowed: false,
        message: "Only email addresses from approved domains are allowed. Please contact your administrator.",
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking domain whitelist:", error);
    return { allowed: true };
  }
}
