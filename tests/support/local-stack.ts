import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

// Aborts any automated test that would reach a Supabase other than the local
// test stack. The Supabase project holds real data (architecture.md §11).
export function assertLocalSupabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      "No local Supabase URL. Start the local test stack with `npm run db:start`.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Supabase URL: ${value}`);
  }
  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing to run tests against ${url.origin}: automated tests run only against the local test stack.`,
    );
  }
  return value;
}

// Parses `supabase status -o env` output (KEY="value" lines).
export function parseStatusEnv(output: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// A client for the local test stack, without persisted sessions.
export function localClient(
  url: string,
  publishableKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(assertLocalSupabaseUrl(url), publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
