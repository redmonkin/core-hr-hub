import { supabase } from "@/integrations/supabase/client";

// Current application version - update this when releasing new versions
export const APP_VERSION = "1.0.0";

// Production API URL for version checking (used by self-hosted instances)
export const VERSION_API_URL = "https://peoplo.redmonk.in/functions/v1/version-check";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  description: string;
  changes: Array<{
    type: "feature" | "fix" | "security" | "docs" | "breaking";
    text: string;
  }>;
}

export interface VersionResponse {
  currentVersion: string;
  releaseDate: string;
  changelog: ChangelogEntry[];
  hasUpdate: boolean;
  updateUrl: string;
  documentationUrl: string;
}

// Local changelog data as fallback
const LOCAL_CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2025-01-19",
    type: "major",
    title: "Initial Release",
    description: "First stable release of Peoplo HR Management System",
    changes: [
      { type: "feature", text: "Complete employee management with CRUD operations" },
      { type: "feature", text: "Leave management with approval workflows" },
      { type: "feature", text: "Attendance tracking with clock in/out" },
      { type: "feature", text: "Payroll management with salary structures" },
      { type: "feature", text: "Performance reviews and goal tracking" },
      { type: "feature", text: "Asset management and assignment" },
      { type: "feature", text: "Department management" },
      { type: "feature", text: "Role-based access control (Admin, HR, Manager, Employee)" },
      { type: "feature", text: "Email notifications via Resend" },
      { type: "feature", text: "Company calendar with events and holidays" },
      { type: "feature", text: "Comprehensive reporting system" },
      { type: "security", text: "Row Level Security (RLS) policies for data protection" },
      { type: "docs", text: "Complete documentation for self-hosting" },
    ],
  },
];

export const FALLBACK_VERSION_RESPONSE: VersionResponse = {
  currentVersion: APP_VERSION,
  releaseDate: "2025-01-19",
  changelog: LOCAL_CHANGELOG,
  hasUpdate: false,
  updateUrl: "https://github.com/redmonk-org/peoplo/releases",
  documentationUrl: "https://peoplo.redmonk.in",
};

export async function checkForUpdates(): Promise<VersionResponse | null> {
  try {
    // First try the local edge function (Lovable Cloud / connected Supabase)
    const { data, error } = await supabase.functions.invoke("version-check", {
      body: { version: APP_VERSION },
    });

    if (!error && data) {
      return data as VersionResponse;
    }

    // In Lovable preview/published environments, the public peoplo.redmonk.in endpoint
    // may not be deployed yet, so don't block UI on a failing network call.
    const isLovableHost =
      typeof window !== "undefined" && window.location.hostname.includes("lovable");

    if (isLovableHost) {
      return FALLBACK_VERSION_RESPONSE;
    }

    // Self-hosted / OSS instances: always fallback to the public production API
    const response = await fetch(`${VERSION_API_URL}?version=${APP_VERSION}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return await response.json();
    }

    return FALLBACK_VERSION_RESPONSE;
  } catch (error) {
    console.error("Error checking for updates:", error);
    return FALLBACK_VERSION_RESPONSE;
  }
}
