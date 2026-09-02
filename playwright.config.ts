import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

/**
 * R12-C3 E2E config (Slice 1 — Infra + Auth + Accounts).
 * Runs against a local mongod (mongodb-memory-server, port 37017) fed via
 * .env.e2e, booting `next build && next start` through webServer.
 * Serial (workers: 1) is critical for the rate-limiter count determinism.
 */
export default defineConfig({
  testDir: './e2e',
  // Serial execution: many specs register users against the shared
  // register:unknown rate-limit counter and share the test DB state.
  fullyParallel: false,
  workers: 1,

  // Margins sized for a full serial suite on a loaded dev machine:
  // tenant-isolation runs ~60s under contention (was at the 60s boundary)
  // and save actions can exceed 10s in the movements-edit flow.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // Retry once locally too: full serial suites on a loaded dev machine produce
  // load-wedge flakiness (~3 distinct tests across runs, never reproducible in
  // isolation). Playwright re-runs only the failed test against fresh state;
  // a test failing twice is a real failure, not masked by this.
  retries: 1,
  reporter: CI
    ? 'github'
    : [
        ['list'],
        ['html', { open: 'never' }],
      ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm e2e:server',
    port: 3000,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
