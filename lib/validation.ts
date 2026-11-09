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

export function validateFullName(
  value: string,
): "validation.fullNameRequired" | "validation.fullNameTooLong" | undefined {
  const name = value.trim();
  if (!name) return "validation.fullNameRequired";
  if (codePointLength(name) > 100) return "validation.fullNameTooLong";
  return undefined;
}

// Full years between a YYYY-MM-DD date and today, as the database computes it.
export function ageOn(birthDate: string, today: Date): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateBirthDate(
  value: string,
  today = new Date(),
):
  | "validation.birthDateRequired"
  | "validation.birthDateOutOfRange"
  | undefined {
  const age = ageOn(value, today);
  if (age === undefined) return "validation.birthDateRequired";
  if (age < 16 || age > 100) return "validation.birthDateOutOfRange";
  return undefined;
}

export function validateBusinessName(
  value: string,
):
  | "validation.businessNameRequired"
  | "validation.businessNameTooLong"
  | undefined {
  const name = value.trim();
  if (!name) return "validation.businessNameRequired";
  if (codePointLength(name) > 120) return "validation.businessNameTooLong";
  return undefined;
}
