import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";
import {
  assertLocalSupabaseUrl,
  parseStatusEnv,
} from "./tests/support/local-stack";

// The end-to-end test runs a production build against the local test stack,
// never against the Supabase project (architecture.md §11).
function localStack() {
  try {
    return parseStatusEnv(
      execFileSync("npx", ["supabase", "status", "-o", "env"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    throw new Error(
      "The local test stack is not running. Start it with `npm run db:start`.",
    );
  }
}
const stack = localStack();
const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: `http://localhost:${port}`,
    // Optional: a system Chromium when Playwright's own browser is missing.
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: `npx next build && npx next start -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: assertLocalSupabaseUrl(stack.API_URL),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.PUBLISHABLE_KEY,
    },
  },
});
