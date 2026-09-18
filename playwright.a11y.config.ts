import { defineConfig, devices } from "@playwright/test";

/**
 * A11y scan config (UX-11) — NOT part of the e2e suite, NOT wired into CI.
 * Mirrors the TTI config (playwright.tti.config.ts) isolation shape: own
 * testDir (`./e2e-a11y`), serial workers, production-build webServer on port
 * 3200 (TTI uses 3100; the e2e suite uses 3000), reuse-existing-server off.
 * The main `playwright.config.ts` declares `testDir: "./e2e"`, so
 * `e2e-a11y/scan.spec.ts` can never be picked up by the CI e2e suite
 * (structural proof lives in `e2e-a11y/isolation.spec.ts`).
 * Run explicitly:
 *   node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.a11y.config.ts
 */
export default defineConfig({
  testDir: "./e2e-a11y",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Production build + start (same pipeline as e2e/TTI) so the scan audits
    // the shipped bundle, never a dev server.
    command: "pnpm exec next build && pnpm exec next start --port 3200",
    port: 3200,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
});
