import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type CurrentUser = { id: string; email: string | null };

// Returns the signed-in user, or null. Uses getClaims(), which verifies the
// access token, and never getSession(), whose user comes unverified from the
// cookie (architecture.md §7).
export async function getCurrentUser(
  supabase: SupabaseClient<Database>,
): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
