// Public URLs for the open-source project. Self-hosters can point these at
// their own fork in .env; the fallbacks are the upstream repository.

/** Source repository linked from the marketing pages and the app (AGPL-3.0 §13). */
export const REPO_URL = (import.meta.env.VITE_REPO_URL || "https://github.com/redmonkin/core-hr-hub").replace(/\/$/, "");

export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const SELF_HOST_GUIDE_URL = `${REPO_URL}#setup-instructions`;
export const SECURITY_POLICY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const ISSUES_URL = `${REPO_URL}/issues`;
