import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyBranding {
  companyName: string;
  companyAddress: string;
  logoUrl: string | null;
  iconUrl: string | null;
}

interface CompanyBrandingRow {
  company_name?: string;
  company_address?: string;
  logo_url?: string | null;
  icon_url?: string | null;
}

const DEFAULT_BRANDING: CompanyBranding = {
  companyName: "",
  companyAddress: "",
  logoUrl: null,
  iconUrl: null,
};

export function useCompanyBranding() {
  return useQuery({
    queryKey: ["company-branding"],
    queryFn: async (): Promise<CompanyBranding> => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("setting_value")
        .eq("setting_key", "company_branding")
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_BRANDING;

      const row = data.setting_value as CompanyBrandingRow;
      return {
        companyName: row.company_name ?? "",
        companyAddress: row.company_address ?? "",
        logoUrl: row.logo_url ?? null,
        iconUrl: row.icon_url ?? null,
      };
    },
  });
}

export function useUpdateCompanyBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branding: CompanyBranding) => {
      const { error } = await supabase
        .from("organization_settings")
        .update({
          setting_value: {
            company_name: branding.companyName,
            company_address: branding.companyAddress,
            logo_url: branding.logoUrl,
            icon_url: branding.iconUrl,
          },
        })
        .eq("setting_key", "company_branding");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-branding"] });
    },
  });
}

const MAX_BRANDING_ASSET_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_BRANDING_ASSET_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export function useUploadBrandingAsset() {
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "logo" | "icon" }) => {
      if (file.size > MAX_BRANDING_ASSET_BYTES) {
        throw new Error("File is too large. Maximum size is 2MB.");
      }
      if (!ALLOWED_BRANDING_ASSET_TYPES.includes(file.type)) {
        throw new Error("Unsupported file type. Allowed: PNG, JPG, SVG, WEBP.");
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${kind}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-branding")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("company-branding").getPublicUrl(fileName);
      // Cache-bust so the browser/img tag picks up a re-uploaded file at the same path
      return `${data.publicUrl}?t=${Date.now()}`;
    },
  });
}
