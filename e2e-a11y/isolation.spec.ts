import { test, expect } from "@playwright/test";

/**
 * UX-11 task 2.5 — structural isolation proof.
 * The main `playwright.config.ts` isolates the CI e2e suite through
 * `testDir: "./e2e"` (NOT a testMatch glob). Because `./e2e-a11y` is not a
 * subpath of `./e2e`, Playwright's directory-based test discovery can never
 * discover the a11y spec — a stricter equivalent of a testMatch negative
 * check. This spec asserts that programmatically so the exclusion is
 * provable, not asserted in prose.
 *
 * Note: `@playwright/test` is loaded here (the scan runner), not the main
 * runner — importing the config module directly is safe (it is data, and
 * `defineConfig` performs no enforcement side effects).
 */
import mainConfig from "../playwright.config";

test("main e2e config's testDir provably excludes e2e-a11y/**", () => {
  const testDir = mainConfig.testDir;
  expect(testDir).toBe("./e2e");

  // Path-structural negative check: e2e-a11y cannot be resolved inside testDir.
  const a11yDir = "./e2e-a11y";
  const inside = a11yDir.startsWith(`${testDir}/`) || a11yDir === testDir;
  expect(inside).toBe(false);
});
