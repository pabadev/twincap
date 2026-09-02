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

  timeout: 60_000,
  expect: { timeout: 10_000 },

  retries: CI ? 2 : 0,
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
