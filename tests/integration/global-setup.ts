import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { assertLocalSupabaseUrl, parseStatusEnv } from "../support/local-stack";

// Integration tests receive the local test stack's URL and key from
// `supabase status`, never from .env.local (architecture.md §11).
export default function setup(project: TestProject) {
  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "The local test stack is not running. Start it with `npm run db:start`.",
    );
  }
  const env = parseStatusEnv(output);
  project.provide("supabaseUrl", assertLocalSupabaseUrl(env.API_URL));
  project.provide("supabasePublishableKey", env.PUBLISHABLE_KEY);
}

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    supabasePublishableKey: string;
  }
}
