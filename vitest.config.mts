import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          // Integration tests need the local stack; e2e tests run with
          // Playwright; database tests with pgTAP.
          exclude: [
            ...configDefaults.exclude,
            "tests/integration/**",
            "tests/e2e/**",
            "supabase/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
