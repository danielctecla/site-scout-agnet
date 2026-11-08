import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type HomePath = "/onboarding" | "/dashboard";

// Where a signed-in user belongs: the dashboard once onboarding is complete,
// otherwise onboarding (specification.md SPEC-ROUTE-05).
export async function homePathFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HomePath> {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  return data?.onboarding_completed_at ? "/dashboard" : "/onboarding";
}
