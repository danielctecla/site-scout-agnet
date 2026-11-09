import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  redirectFor,
  rootDestination,
  type PageAccess,
  type UserState,
} from "@/lib/routing";
import { getCurrentUser, type CurrentUser } from "./auth";
import type { Database } from "./database.types";
import { homePathFor } from "./home-path";
import { createClient } from "./server";

type Session = {
  supabase: SupabaseClient<Database>;
  user: CurrentUser | null;
  state: UserState;
};

// Validates the user with getClaims() (never getSession()) and reads the
// onboarding state through RLS (architecture.md §7). connection(): these pages
// depend on the session, so they render only for a real request, never in a
// prerender or prefetch (getClaims() reads the current time).
async function readSession(): Promise<Session> {
  await connection();
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { supabase, user, state: "anonymous" };
  const home = await homePathFor(supabase, user.id);
  return {
    supabase,
    user,
    state: home === "/dashboard" ? "complete" : "onboarding",
  };
}

// Called at the top of every page whose access depends on the session; pages
// call it themselves because layouts are not re-rendered on every navigation.
export async function guardPage(access: "guest"): Promise<Session>;
export async function guardPage(
  access: Exclude<PageAccess, "guest">,
): Promise<Session & { user: CurrentUser }>;
export async function guardPage(access: PageAccess): Promise<Session> {
  const session = await readSession();
  const destination = redirectFor(access, session.state);
  if (destination) redirect(destination);
  return session;
}

export async function redirectFromRoot(): Promise<never> {
  const { state } = await readSession();
  redirect(rootDestination(state));
}
