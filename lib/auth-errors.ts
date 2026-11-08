// Maps Supabase Auth error codes to translation keys (architecture.md §9).
// Supabase's own messages are never shown; unknown codes and network failures
// map to the generic message.
const AUTH_ERROR_KEYS = {
  invalid_credentials: "errors.auth.invalid_credentials",
  user_already_exists: "errors.auth.user_already_exists",
  email_exists: "errors.auth.user_already_exists",
  weak_password: "errors.auth.weak_password",
} as const;

export type AuthErrorKey =
  | (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS]
  | "errors.auth.generic";

export function authErrorKey(code: string | undefined): AuthErrorKey {
  if (code && Object.hasOwn(AUTH_ERROR_KEYS, code)) {
    return AUTH_ERROR_KEYS[code as keyof typeof AUTH_ERROR_KEYS];
  }
  return "errors.auth.generic";
}
