import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set }),
}));

const { setLocalePreference } = await import("./actions");

describe("setLocalePreference", () => {
  beforeEach(() => {
    set.mockClear();
  });

  it("stores a supported language in the locale cookie for one year", async () => {
    await setLocalePreference("en");
    expect(set).toHaveBeenCalledWith("locale", "en", {
      path: "/",
      sameSite: "lax",
      maxAge: 31_536_000,
      httpOnly: true,
    });
  });

  it("ignores unsupported values", async () => {
    await setLocalePreference("fr");
    await setLocalePreference("");
    expect(set).not.toHaveBeenCalled();
  });
});
