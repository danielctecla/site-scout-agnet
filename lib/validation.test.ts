import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { authErrorKey } from "./auth-errors";
import { dbErrorKey } from "./db-errors";
import {
  codePointLength,
  validateBirthDate,
  validateEmail,
  validateFullName,
  validatePassword,
} from "./validation";

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

describe("onboarding validation", () => {
  const today = new Date(2026, 10, 8); // 8 Nov 2026

  it("requires a full name of at most 100 characters", () => {
    expect(validateFullName("   ")).toBe("validation.fullNameRequired");
    expect(validateFullName("x".repeat(101))).toBe(
      "validation.fullNameTooLong",
    );
    expect(validateFullName(" Ana ")).toBeUndefined();
  });

  it("accepts ages 16 to 100 only", () => {
    expect(validateBirthDate("", today)).toBe("validation.birthDateRequired");
    expect(validateBirthDate("2010-11-09", today)).toBe(
      "validation.birthDateOutOfRange",
    ); // 15
    expect(validateBirthDate("2010-11-08", today)).toBeUndefined(); // 16 today
    expect(validateBirthDate("1925-11-09", today)).toBeUndefined(); // 100
    expect(validateBirthDate("1925-11-08", today)).toBe(
      "validation.birthDateOutOfRange",
    ); // 101
  });
});

describe("dbErrorKey", () => {
  it("translates contract codes and hides anything else", () => {
    expect(dbErrorKey({ code: "P0001", message: "invalid_industry" })).toBe(
      "errors.invalid_industry",
    );
    expect(dbErrorKey({ code: "P0001", message: "something else" })).toBe(
      "errors.generic",
    );
    expect(dbErrorKey({ code: "42501", message: "permission denied" })).toBe(
      "errors.generic",
    );
    expect(dbErrorKey(null)).toBe("errors.generic");
  });
});
