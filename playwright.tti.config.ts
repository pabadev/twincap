import { defineConfig, devices } from '@playwright/test';

/**
 * TTI measurement config (UX-5, H-17) — NOT part of the e2e suite.
 * Boots a production `next build && next start` against a throwaway local
 * mongod (same global-setup/teardown as e2e) and runs the measurement spec
 * in `e2e-tti/`. Run explicitly:
 *   node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.tti.config.ts
 */
export default defineConfig({
  testDir: './e2e-tti',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Production build + start (port 3100: 3000 may host a dev server),
    // exactly like the e2e suite. Never reuse an existing server: a dev
    // server would not measure the production bundle.
    command: 'pnpm exec next build && pnpm exec next start --port 3100',
    port: 3100,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});