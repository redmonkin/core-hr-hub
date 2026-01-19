// Current application version - update this when releasing new versions
export const APP_VERSION = "1.0.0";

// Production API URL for version checking
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

export async function checkForUpdates(): Promise<VersionResponse | null> {
  try {
    const response = await fetch(`${VERSION_API_URL}?version=${APP_VERSION}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to check for updates:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking for updates:', error);
    return null;
  }
}
