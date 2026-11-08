// Form validation helpers (architecture.md §2). They return translation keys,
// never text. The database and Supabase Auth enforce the same rules.

export type EmailError = "validation.emailRequired" | "validation.emailInvalid";
export type PasswordError =
  "validation.passwordRequired" | "validation.passwordTooShort";

export const MIN_PASSWORD_LENGTH = 8;

// Length in Unicode code points, like PostgreSQL's char_length (unlike
// JavaScript's String.length, which counts UTF-16 units).
export function codePointLength(value: string): number {
  return [...value].length;
}

export function validateEmail(value: string): EmailError | undefined {
  const email = value.trim();
  if (!email) return "validation.emailRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "validation.emailInvalid";
  }
  return undefined;
}

// Login checks presence only; registration and new passwords also check the
// minimum length (requirements.md FR-01).
export function validatePassword(
  value: string,
  { requireMinLength }: { requireMinLength: boolean },
): PasswordError | undefined {
  if (!value) return "validation.passwordRequired";
  if (requireMinLength && codePointLength(value) < MIN_PASSWORD_LENGTH) {
    return "validation.passwordTooShort";
  }
  return undefined;
}
