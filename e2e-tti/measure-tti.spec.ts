import { test, type BrowserContext } from '@playwright/test';
import { registerUser, seedFinancialData } from '../e2e/helpers';

/**
 * UX-5 closure — TTI (H-17) measurement, protocol §8.1 of
 * docs/UX-RESUMEN-DESIGN.md. NOT part of the e2e suite; run explicitly with
 *   node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.tti.config.ts
 *
 * Method (documented deviations from §8.1):
 * - Production build (`next build && next start`, plain Node, not serverless).
 * - COLD = first navigation to /dashboard in a fresh browser context with an
 *   empty HTTP cache (session cookie pre-seeded via storageState).
 * - HOT = repeated reload in the same context (cached shell).
 * - Breakpoints 375 / 768 / 1280; navigation timing via PerformanceEntry;
 *   "hero visible" = first paint of N1 content (only after the skeleton).
 * - Extra: mobile cold run emulates slow-3G through CDP.
 */

type Sample = {
  run: string;
  viewport: string;
  throttle: 'none' | '3g';
  heroVisibleMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  resources: number;
  transferBytes: number;
};

const samples: Sample[] = [];

const HERO = [
  /How did I do\?/,
  /How much do I have available\?/,
] as const;

async function heroVisibleMs(page: import('@playwright/test').Page): Promise<number> {
  await Promise.race(
    HERO.map((re) =>
      page.getByText(re).first().waitFor({ state: 'visible', timeout: 60_000 }),
    ),
  );
  return page.evaluate(() => performance.now());
}

async function navTiming(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const res = performance.getEntriesByType('resource');
    return {
      domContentLoadedMs: Math.round(n.domContentLoadedEventEnd),
      loadMs: Math.round(n.loadEventEnd),
      resources: res.length,
      transferBytes: Math.round(n.transferSize),
    };
  });
}

async function measureRun(
  context: BrowserContext,
  label: string,
  viewport: string,
  throttle: 'none' | '3g',
): Promise<void> {
  const page = await context.newPage();

  if (throttle === '3g') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1_600_000 / 8) * 0.8,
      uploadThroughput: (768_000 / 8) * 0.8,
    });
  }

  const hero = heroVisibleMs(page);
  await page.goto('/dashboard', { waitUntil: 'commit' });
  const heroVisibleMsValue = await hero;
  await page.waitForLoadState('load');
  const timing = await navTiming(page);

  samples.push({
    run: label,
    viewport,
    throttle,
    heroVisibleMs: Math.round(heroVisibleMsValue),
    ...timing,
  });
  await page.close();
}

test('UX-5 TTI measurement — Resumen cold/hot at 375/768/1280', async ({ browser }) => {
  test.setTimeout(300_000);

  // --- Seed a user with real data through the UI (context 1, not measured). ---
  const seedContext = await browser.newContext();
  const seedPage = await seedContext.newPage();
  const email = await registerUser(seedPage);
  await seedFinancialData(seedPage, {
    monthlyIncome: '1000000',
    monthlyExpense: '300000',
  });
  const storageState = await seedContext.storageState();
  await seedContext.close();
  console.log(`[tti] seeded user: ${email}`);

  // --- COLD + HOT per breakpoint, on an authenticated but cache-empty context. ---
  const viewports: Array<{ label: string; width: number; height: number; mobile?: boolean }> = [
    { label: '375', width: 375, height: 812, mobile: true },
    { label: '768', width: 768, height: 1024 },
    { label: '1280', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    const coldContext = await browser.newContext({
      storageState,
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile ?? false,
      hasTouch: vp.mobile ?? false,
      deviceScaleFactor: vp.mobile ? 3 : 1,
    });
    await measureRun(coldContext, `cold`, vp.label, vp.mobile ? '3g' : 'none');
    // Hot = repeated reload on the now-warm context (cache + connections).
    await measureRun(coldContext, `hot-1`, vp.label, 'none');
    await measureRun(coldContext, `hot-2`, vp.label, 'none');
    await coldContext.close();
  }

  // --- Report as a JSON block (captured from the run for docs/UX-5-TTI-REPORT.md). ---
  console.log('TTI_RESULTS ' + JSON.stringify(samples, null, 2));

  const cold375 = samples.find((s) => s.run === 'cold' && s.viewport === '375');
  const hotBest = samples
    .filter((s) => s.run.startsWith('hot'))
    .reduce<Sample | undefined>((best, s) => (!best || s.loadMs < best.loadMs ? s : best), undefined);

  // Protocol objectives (§8.1): cold < 10 s, hot < 2 s. Not gate-failing: this
  // spec records evidence; regression-failing lives in the phase doc.
  if (cold375 && cold375.heroVisibleMs > 10_000) {
    console.warn(`[tti] COLD hero > 10 s at 375 (${cold375.heroVisibleMs} ms) — Regla de Oro at risk`);
  }
  if (hotBest && hotBest.loadMs > 2_000) {
    console.warn(`[tti] HOT load > 2 s (${hotBest.loadMs} ms at ${hotBest.viewport})`);
  }
});