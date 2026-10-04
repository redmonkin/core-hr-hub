import { describe, expect, it } from "vitest";
import {
  NO_PERMISSIONS,
  Permissions,
  canAccessReports,
  canAccessSettings,
  hasAnyModuleAccess,
  hasModuleAccess,
  isMissingFunctionError,
  levelSatisfies,
  parsePermissions,
  permissionsFromRoles,
} from "./permissions";

const perms = (overrides: Partial<Permissions>): Permissions => ({ ...NO_PERMISSIONS, ...overrides });

describe("levelSatisfies", () => {
  it("manage satisfies view and manage", () => {
    expect(levelSatisfies("manage", "view")).toBe(true);
    expect(levelSatisfies("manage", "manage")).toBe(true);
  });

  it("view satisfies only view", () => {
    expect(levelSatisfies("view", "view")).toBe(true);
    expect(levelSatisfies("view", "manage")).toBe(false);
  });

  it("no grant satisfies nothing", () => {
    expect(levelSatisfies(undefined, "view")).toBe(false);
  });
});

describe("hasModuleAccess", () => {
  it("gives an assets-only user assets and nothing else", () => {
    const p = perms({ modules: { assets: "manage" } });
    expect(hasModuleAccess(p, "assets", "manage")).toBe(true);
    expect(hasModuleAccess(p, "payroll")).toBe(false);
    expect(hasModuleAccess(p, "employees")).toBe(false);
  });

  it("defaults to the view level", () => {
    expect(hasModuleAccess(perms({ modules: { payroll: "view" } }), "payroll")).toBe(true);
  });

  it("gives admins everything", () => {
    expect(hasModuleAccess(perms({ isAdmin: true }), "settings", "manage")).toBe(true);
  });

  it("gives blocked users nothing, even admins", () => {
    expect(hasModuleAccess(perms({ isAdmin: true, isBlocked: true }), "assets")).toBe(false);
    expect(hasAnyModuleAccess(perms({ isBlocked: true, modules: { assets: "view" } }))).toBe(false);
  });
});

describe("hasAnyModuleAccess", () => {
  it("is false for plain employees and true with any grant", () => {
    expect(hasAnyModuleAccess(NO_PERMISSIONS)).toBe(false);
    expect(hasAnyModuleAccess(perms({ modules: { calendar: "view" } }))).toBe(true);
    expect(hasAnyModuleAccess(perms({ isAdmin: true }))).toBe(true);
  });
});

describe("canAccessSettings", () => {
  it("requires manage on a settings-related module", () => {
    expect(canAccessSettings(perms({ modules: { settings: "view" } }))).toBe(false);
    expect(canAccessSettings(perms({ modules: { leaves: "manage" } }))).toBe(true);
    expect(canAccessSettings(perms({ modules: { assets: "manage" } }))).toBe(false);
    expect(canAccessSettings(perms({ isAdmin: true }))).toBe(true);
  });
});

describe("canAccessReports", () => {
  it("opens for viewers of any module with a report", () => {
    expect(canAccessReports(perms({ modules: { attendance: "view" } }))).toBe(true);
    expect(canAccessReports(perms({ modules: { calendar: "manage" } }))).toBe(false);
  });
});

describe("parsePermissions", () => {
  it("parses the get_my_permissions payload", () => {
    expect(
      parsePermissions({
        is_admin: false,
        is_blocked: false,
        roles: ["employee"],
        modules: { assets: "manage", payroll: "view" },
      })
    ).toEqual({ isAdmin: false, isBlocked: false, roles: ["employee"], modules: { assets: "manage", payroll: "view" } });
  });

  it("drops unknown modules and levels", () => {
    expect(parsePermissions({ modules: { assets: "owner", rockets: "manage", leaves: "view" } }).modules).toEqual({
      leaves: "view",
    });
  });

  it("returns no permissions for empty or malformed input", () => {
    expect(parsePermissions(null)).toEqual(NO_PERMISSIONS);
    expect(parsePermissions("nope")).toEqual(NO_PERMISSIONS);
  });
});

describe("permissionsFromRoles (fallback before migrations)", () => {
  it("gives admins everything", () => {
    const p = permissionsFromRoles(["admin", "hr"]);
    expect(p.isAdmin).toBe(true);
    expect(hasModuleAccess(p, "payroll", "manage")).toBe(true);
  });

  it("gives HR manage on every module", () => {
    const p = permissionsFromRoles(["hr"]);
    expect(p.isAdmin).toBe(false);
    expect(hasModuleAccess(p, "settings", "manage")).toBe(true);
    expect(hasModuleAccess(p, "assets", "manage")).toBe(true);
  });

  it("gives managers and employees no module access", () => {
    expect(hasAnyModuleAccess(permissionsFromRoles(["manager"]))).toBe(false);
    expect(hasAnyModuleAccess(permissionsFromRoles(["employee"]))).toBe(false);
  });
});

describe("isMissingFunctionError", () => {
  it("recognises PostgREST and Postgres missing-function codes", () => {
    expect(isMissingFunctionError({ code: "PGRST202" })).toBe(true);
    expect(isMissingFunctionError({ code: "42883" })).toBe(true);
    expect(isMissingFunctionError({ code: "42501" })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
  });
});
