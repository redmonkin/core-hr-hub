// Production domain for the official SaaS offering
export const PRODUCTION_DOMAIN = "peoplo.redmonk.in";

// Check if the current site is the production/SaaS domain
export function isProductionDomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === PRODUCTION_DOMAIN;
}
