import { describe, expect, it } from "vitest";
import { assertLocalSupabaseUrl, parseStatusEnv } from "./local-stack";

describe("assertLocalSupabaseUrl", () => {
  it("accepts the local test stack", () => {
    expect(assertLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    );
    expect(assertLocalSupabaseUrl("http://localhost:54321")).toBe(
      "http://localhost:54321",
    );
  });

  it("aborts for the Supabase project or any other host", () => {
    expect(() =>
      assertLocalSupabaseUrl("https://abcdefghijklmnopqrst.supabase.co"),
    ).toThrow(/Refusing to run tests/);
    expect(() => assertLocalSupabaseUrl("https://127.0.0.1:54321")).toThrow(
      /Refusing to run tests/,
    );
    expect(() => assertLocalSupabaseUrl("http://127.0.0.2:54321")).toThrow(
      /Refusing to run tests/,
    );
  });

  it("aborts when the URL is missing or invalid", () => {
    expect(() => assertLocalSupabaseUrl(undefined)).toThrow(/npm run db:start/);
    expect(() => assertLocalSupabaseUrl("not a url")).toThrow(/Invalid/);
  });
});

describe("parseStatusEnv", () => {
  it('reads KEY="value" lines', () => {
    expect(
      parseStatusEnv(
        'API_URL="http://127.0.0.1:54321"\nPUBLISHABLE_KEY="pk"\n',
      ),
    ).toEqual({ API_URL: "http://127.0.0.1:54321", PUBLISHABLE_KEY: "pk" });
  });
});
