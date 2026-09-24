import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  },
}));

const { checkEmailDomainAllowed } = await import("./domainWhitelist");

function mockSetting(value: unknown) {
  maybeSingle.mockResolvedValue({ data: value === undefined ? null : { setting_value: value }, error: null });
}

describe("checkEmailDomainAllowed", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("allows everything when no setting exists", async () => {
    mockSetting(undefined);
    expect(await checkEmailDomainAllowed("a@anything.com")).toEqual({ allowed: true });
  });

  it("allows everything when the whitelist is disabled", async () => {
    mockSetting({ enabled: false, domains: ["redmonk.in"] });
    expect((await checkEmailDomainAllowed("a@gmail.com")).allowed).toBe(true);
  });

  it("allows everything when the whitelist is enabled but empty", async () => {
    mockSetting({ enabled: true, domains: [] });
    expect((await checkEmailDomainAllowed("a@gmail.com")).allowed).toBe(true);
  });

  describe("when enabled", () => {
    beforeEach(() => mockSetting({ enabled: true, domains: ["redmonk.in", "Example.COM"] }));

    it("allows listed domains case-insensitively", async () => {
      expect((await checkEmailDomainAllowed("samita@redmonk.in")).allowed).toBe(true);
      expect((await checkEmailDomainAllowed("x@EXAMPLE.com")).allowed).toBe(true);
    });

    it("rejects other domains with a message", async () => {
      const result = await checkEmailDomainAllowed("someone@gmail.com");
      expect(result.allowed).toBe(false);
      expect(result.message).toMatch(/approved domains/);
    });

    it.each([
      "a@notredmonk.in",
      "a@redmonk.in.evil.com",
      "a@sub.redmonk.in",
      "redmonk.in@evil.com",
      "no-at-sign",
    ])("rejects look-alike address %s", async (email) => {
      expect((await checkEmailDomainAllowed(email)).allowed).toBe(false);
    });
  });

  it("fails open if the settings lookup throws", async () => {
    maybeSingle.mockRejectedValue(new Error("network"));
    expect((await checkEmailDomainAllowed("a@gmail.com")).allowed).toBe(true);
  });
});
