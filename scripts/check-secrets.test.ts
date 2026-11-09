import { describe, expect, it } from "vitest";
import { findSecrets } from "./check-secrets.mjs";

// Fixtures are assembled at runtime so this file never contains a value that
// the scanner itself would flag.
const join = (...parts: string[]) => parts.join("");

function jwt(payload: object) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode(payload),
    "c2lnbmF0dXJl",
  ].join(".");
}

describe("findSecrets", () => {
  it("flags a Supabase secret API key and reports its line", () => {
    const text = join(
      "first line\nKEY=",
      "sb_",
      "secret_",
      "N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    );
    expect(findSecrets(text)).toEqual([
      expect.objectContaining({ rule: "supabase-secret-key", line: 2 }),
    ]);
  });

  it("ignores documentation that only names the key prefix", () => {
    expect(
      findSecrets(join("Scan for keys with the `", "sb_", "secret_` prefix.")),
    ).toEqual([]);
  });

  it("ignores publishable keys", () => {
    expect(
      findSecrets(
        join("sb_", "publishable_", "ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"),
      ),
    ).toEqual([]);
  });

  it("flags a Supabase personal access token", () => {
    const text = join("sbp_", "0123456789abcdef0123456789abcdef01234567");
    expect(findSecrets(text)).toEqual([
      expect.objectContaining({ rule: "supabase-access-token" }),
    ]);
  });

  it("flags a service_role JWT but not an anon JWT", () => {
    expect(findSecrets(jwt({ role: "service_role" }))).toEqual([
      expect.objectContaining({ rule: "service-role-jwt" }),
    ]);
    expect(findSecrets(jwt({ role: "anon" }))).toEqual([]);
  });

  it("flags a remote database URL with a password", () => {
    const text = join(
      "postgresql://",
      "postgres:",
      "hunter2hunter2",
      "@db.abcdefgh.supabase.co:5432/postgres",
    );
    expect(findSecrets(text)).toEqual([
      expect.objectContaining({ rule: "database-url-password" }),
    ]);
  });

  it("ignores the local test stack URL and placeholder passwords", () => {
    expect(
      findSecrets(
        join(
          "postgresql://",
          "postgres:",
          "postgres",
          "@127.0.0.1:54322/postgres",
        ),
      ),
    ).toEqual([]);
    expect(
      findSecrets(
        join(
          "postgresql://",
          "postgres:",
          "[YOUR-PASSWORD]",
          "@db.ref.supabase.co:5432/postgres",
        ),
      ),
    ).toEqual([]);
  });
});
