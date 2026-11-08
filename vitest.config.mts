import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    // End-to-end tests run with Playwright; database tests with pgTAP.
    exclude: [...configDefaults.exclude, "tests/e2e/**", "supabase/**"],
    environment: "node",
  },
});
