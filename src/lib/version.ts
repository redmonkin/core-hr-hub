import { supabase } from "@/integrations/supabase/client";

// Current application version - update this when releasing new versions
export const APP_VERSION = "1.1.1";

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
    version: "1.1.0",
    date: "2026-07-22",
    type: "minor",
    title: "Payroll, Branding, and Self-Service Email",
    description: "PF deductions, company branding across the app and all PDFs, self-service email changes, and a round of reliability and security fixes",
    changes: [
      { type: "feature", text: "Salary structures now have a dedicated Provident Fund (PF) deduction field instead of a generic \"Other\" deduction" },
      { type: "feature", text: "Salary entry forms now clearly state that figures are monthly, not annual (CTC)" },
      { type: "feature", text: "Redesigned payslip PDF with a professional layout: company details, employee joining date, designation, department, worked days, itemized earnings & deductions, and net pay spelled out in words" },
      { type: "feature", text: "Company branding: admins can set the organization's name, address, logo, and icon from Settings, shown in the sidebar and on generated payslips and reports" },
      { type: "feature", text: "Every generated PDF report (Attendance, Payroll Summary, Leave Balance, Asset Inventory, Employee Report, Performance & Team Analytics, and list exports) now shares one consistent, branded, professional style" },
      { type: "feature", text: "Employees can change their own email address from their Profile, with confirmation-by-link and organization domain whitelist enforcement" },
      { type: "feature", text: "Faster initial page loads via route-level code splitting, plus a global error boundary so unexpected errors show a recovery screen instead of a blank page" },
      { type: "fix", text: "Corrected currency symbol rendering that displayed incorrectly in generated PDFs" },
      { type: "fix", text: "Dashboard, Employee Report, and \"My Leave Balance\" now respect each employee's actual leave-type eligibility instead of counting every leave type in the organization" },
      { type: "fix", text: "Payslip PDF now correctly shows an employee's joining date, designation, and department" },
      { type: "security", text: "Closed a Row-Level Security gap that allowed blocked users to still read role and permission data" },
      { type: "security", text: "Added standard security response headers (CSP, X-Frame-Options, and more)" },
      { type: "docs", text: "Added feature screenshots to the public marketing pages" },
    ],
  },
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
  releaseDate: "2026-07-22",
  changelog: LOCAL_CHANGELOG,
  hasUpdate: false,
  updateUrl: "https://github.com/redmonkin/core-hr-hub/releases",
  documentationUrl: "https://peoplo.redmonk.in",
};

// Detect if running in an auto-updating environment (Lovable Cloud / production)
export function isAutoUpdatingEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname.includes("lovable") ||
    hostname === "peoplo.redmonk.in" ||
    hostname.endsWith(".redmonk.in")
  );
}

export async function checkForUpdates(): Promise<VersionResponse | null> {
  const isAutoUpdating = isAutoUpdatingEnvironment();

  try {
    // First try the local edge function (Lovable Cloud / connected Supabase)
    const { data, error } = await supabase.functions.invoke("version-check", {
      body: { version: APP_VERSION },
    });

    if (!error && data) {
      const response = data as VersionResponse;
      
      // For auto-updating environments, never show update notification
      // but still use the latest version info from GitHub for display
      if (isAutoUpdating) {
        return {
          ...response,
          currentVersion: response.currentVersion, // Use latest from GitHub
          hasUpdate: false, // Never prompt for updates
        };
      }
      
      return response;
    }

    // Fallback for when edge function is unavailable
    if (isAutoUpdating) {
      // For cloud/production, try to fetch from production API for latest changelog
      try {
        const response = await fetch(`${VERSION_API_URL}?version=${APP_VERSION}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        
        if (response.ok) {
          const data = await response.json();
          return { ...data, hasUpdate: false };
        }
      } catch {
        // Ignore fetch errors for cloud environments
      }
      return { ...FALLBACK_VERSION_RESPONSE, hasUpdate: false };
    }

    // Self-hosted / OSS instances: fetch from production API
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
    return isAutoUpdating 
      ? { ...FALLBACK_VERSION_RESPONSE, hasUpdate: false }
      : FALLBACK_VERSION_RESPONSE;
  }
}
