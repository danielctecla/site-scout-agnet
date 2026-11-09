// Database error contract (database.md §7.5): functions raise P0001 with a
// fixed code. Only those codes are shown (translated); anything else shows the
// generic message, never the raw database text.
const CONTRACT_CODES = [
  "not_authenticated",
  "profile_not_found",
  "onboarding_already_completed",
  "personal_info_incomplete",
  "invalid_full_name",
  "invalid_birth_date",
  "invalid_business_name",
  "invalid_industry",
  "invalid_status",
  "business_already_exists",
] as const;

export type ContractCode = (typeof CONTRACT_CODES)[number];
export type DbErrorKey = `errors.${ContractCode}` | "errors.generic";

export function dbErrorKey(
  error: { code?: string; message?: string } | null | undefined,
): DbErrorKey {
  const code = error?.message as ContractCode;
  if (error?.code === "P0001" && CONTRACT_CODES.includes(code)) {
    return `errors.${code}`;
  }
  return "errors.generic";
}
