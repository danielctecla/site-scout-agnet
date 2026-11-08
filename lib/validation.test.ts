import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { authErrorKey } from "./auth-errors";
import { codePointLength, validateEmail, validatePassword } from "./validation";

describe("validateEmail", () => {
  it("requires an email", () => {
    expect(validateEmail("")).toBe("validation.emailRequired");
    expect(validateEmail("   ")).toBe("validation.emailRequired");
  });

  it("rejects malformed emails", () => {
    for (const value of [
      "ana",
      "ana@",
      "@ejemplo.com",
      "ana@ejemplo",
      "ana @ejemplo.com",
    ]) {
      expect(validateEmail(value), value).toBe("validation.emailInvalid");
    }
  });

  it("accepts valid emails, ignoring surrounding spaces", () => {
    expect(validateEmail("ana@ejemplo.com")).toBeUndefined();
    expect(
      validateEmail("  ana.maria+negocio@ejemplo.com.mx "),
    ).toBeUndefined();
  });
});

describe("validatePassword", () => {
  it("requires a password", () => {
    expect(validatePassword("", { requireMinLength: false })).toBe(
      "validation.passwordRequired",
    );
  });

  it("checks the minimum length only when asked", () => {
    expect(validatePassword("1234567", { requireMinLength: true })).toBe(
      "validation.passwordTooShort",
    );
    expect(
      validatePassword("12345678", { requireMinLength: true }),
    ).toBeUndefined();
    expect(
      validatePassword("1234567", { requireMinLength: false }),
    ).toBeUndefined();
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    expect(codePointLength("😀😀😀😀")).toBe(4);
    expect(validatePassword("😀😀😀😀", { requireMinLength: true })).toBe(
      "validation.passwordTooShort",
    );
  });
});

describe("authErrorKey", () => {
  it("maps known Supabase Auth codes", () => {
    expect(authErrorKey("invalid_credentials")).toBe(
      "errors.auth.invalid_credentials",
    );
    expect(authErrorKey("user_already_exists")).toBe(
      "errors.auth.user_already_exists",
    );
    expect(authErrorKey("email_exists")).toBe(
      "errors.auth.user_already_exists",
    );
    expect(authErrorKey("weak_password")).toBe("errors.auth.weak_password");
  });

  it("maps unknown codes, missing codes and prototype names to the generic message", () => {
    for (const code of [
      "over_request_rate_limit",
      undefined,
      "",
      "constructor",
      "toString",
    ]) {
      expect(authErrorKey(code), String(code)).toBe("errors.auth.generic");
    }
  });

  it("only returns keys that exist in both languages", () => {
    for (const code of [
      "invalid_credentials",
      "user_already_exists",
      "weak_password",
      "x",
    ]) {
      const key = authErrorKey(code)
        .split(".")
        .pop() as keyof typeof es.errors.auth;
      expect(es.errors.auth[key]).toBeTruthy();
      expect(en.errors.auth[key]).toBeTruthy();
    }
  });
});
