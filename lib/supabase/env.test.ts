import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseEnv } from "./env";

describe("supabaseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the URL and publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(supabaseEnv()).toEqual({
      url: "https://ref.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });

  it("explains how to configure .env.local when a value is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => supabaseEnv()).toThrow(/\.env\.local/);
  });
});
