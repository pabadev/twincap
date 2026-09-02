import { test, expect, type Page, type Locator } from '@playwright/test';
import { registerUser, logout, seedFinancialData, waitForSnapshotValue } from './helpers';

/**
 * Slice 4 — Dashboard aggregates + logout + tenant isolation + i18n
 * (spec e2e-dashboard-isolation). Runs serially (workers: 1) against a local
 * mongod + production `next start`. Default test locale is `en` (NEXT_LOCALE
 * from .env.e2e); the i18n test switches to `es` via the cookie, then back to
 * `en` through the nav toggle (the only real UI locale switch).
 *
 * Dashboard assertions are post-C1 AGGREGATES only (DashboardSnapshot summary
 * cards) — never full movement lists. Amounts render via `formatAmount`
 * ("COP 10,000" with a non-breaking space), asserted with whitespace-agnostic
 * regexes.
 */

/** Local calendar date as YYYY-MM-DD. */
function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * A civil date that is inside the current year but OUTSIDE the current month
 * (Jan 2 of this year). Such a date discriminates the dashboard period
 * windows: it is always in "this_year" (`filterMovementsByPeriod` matches the
 * UTC year) and never in "current_month" (it matches the UTC year-month) —
 * except when today IS January, where both windows coincide for every date
 * and no discriminator exists (returns null).
 */
function yearlyOutOfMonthDate(): string | null {
  const now = new Date();
  if (now.getMonth() === 0) return null;
  return `${now.getFullYear()}-01-02`;
}

/** The <p> value node that follows a summary-card label (single-currency path). */
function summaryValue(page: Page, label: string): Locator {
  return page
    .getByText(label)
    .first()
    .locator('xpath=following-sibling::p')
    .first();
}

/**
 * Observe the dashboard container's aria-busy flag BEFORE a filter change.
 * Resolves true once the transition marks the container busy (the server
 * action re-aggregation is in flight). MutationObserver fires on the
 * attribute commit, so a sub-frame transition cannot be missed.
 */
function observeBusyTransition(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const root = document.querySelector('div[aria-busy]');
        if (!root) {
          resolve(false);
          return;
        }
        if (root.getAttribute('aria-busy') === 'true') {
          resolve(true);
          return;
        }
        const observer = new MutationObserver(() => {
          if (root.getAttribute('aria-busy') === 'true') {
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(root, {
          attributes: true,
          attributeFilter: ['aria-busy'],
        });
      }),
  );
}

/** Register a fresh unique user and return their email. */
async function freshUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return email;
}

/** Create a new account via the /accounts "Add Account" dialog. */
async function createAccountInUI(page: Page, name: string): Promise<void> {
  await page.goto('/accounts');
  await page.getByRole('button', { name: /Add Account/i }).click();
  const dialog = page.getByRole('dialog', { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account Name').fill(name);
  await dialog.getByLabel('Initial Balance').fill('0');
  await dialog.getByRole('button', { name: /Create Account/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

test.describe('Slice 4 — Dashboard + Isolation', () => {
  test.describe.configure({ mode: 'serial' });

  test('dashboard summary cards show expected aggregates from seeded income and expense', async ({
    page,
  }) => {
    await freshUser(page);
    const dated = yearlyOutOfMonthDate();
    await seedFinancialData(page, {
      monthlyIncome: '100000',
      monthlyExpense: '30000',
      datedIncome: dated ? { amount: '10000', date: dated } : undefined,
      notePrefix: 'slice4-aggregates',
    });

    await page.goto('/dashboard');

    // Income this month: +COP 100,000 (the Jan-2 dated income is this-year,
    // not this-month, so it stays out of the current-month window).
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Income this month'),
      /\+COP\s+100,000/,
    );
    // Expenses this month: −COP 30,000.
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Expenses this month'),
      /COP\s+30,000/,
    );
    // Total balance (all-time): 100,000 + 10,000 − 30,000 = COP 80,000.
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Total Balance'),
      /COP\s+80,000/,
    );
    // Financing flows card: no credits seeded → received/granted COP 0.
    const financing = page
      .getByText('Financing flows')
      .first()
      .locator('xpath=following-sibling::p');
    await expect(financing.first()).toContainText(/\+COP\s+0/);
    await expect(financing.nth(1)).toContainText(/COP\s+0/);
  });

  test('changing the period filter re-fetches the snapshot (aria-busy transition + new values)', async ({
    page,
  }) => {
    await freshUser(page);
    const dated = yearlyOutOfMonthDate();
    await seedFinancialData(page, {
      monthlyIncome: '100000',
      monthlyExpense: '30000',
      datedIncome: dated ? { amount: '10000', date: dated } : undefined,
      notePrefix: 'slice4-filter',
    });

    await page.goto('/dashboard');
    const incomeValue = summaryValue(page, 'Income this month');
    await waitForSnapshotValue(page, incomeValue, /\+COP\s+100,000/);

    // Start watching the transition flag, THEN switch the period filter.
    const busySeen = observeBusyTransition(page);
    await page.getByLabel(/^Period$/).selectOption({ label: 'This year' });

    // The container went aria-busy while the server re-aggregated.
    expect(await busySeen).toBe(true);
    await expect(page.getByLabel(/^Period$/)).toHaveValue('this_year');

    // Summary CARDS are intentionally current-month scoped ("Income this
    // month" must NOT change with the period filter — computeDashboardSummary
    // buckets cards by the current UTC year-month). The period-scoped PROOF of
    // the re-fetch is the "Income Summary" table, derived from the FILTERED
    // movements: when this_year adds the Jan-2 discriminator seed its Total
    // grows to COP 110,000 (in January both windows coincide and it stays
    // COP 100,000).
    const incomeSummaryTotal = page
      .getByRole('heading', { name: /Income Summary/i })
      .locator('xpath=../..')
      .getByText('Total', { exact: true })
      .locator('xpath=following-sibling::span');
    const expectedIncomeTotal = dated ? /COP\s+110,000/ : /COP\s+100,000/;
    await waitForSnapshotValue(page, incomeSummaryTotal, expectedIncomeTotal);

    // The Jan-2 movement is now in the period-filtered recent list (skipped in
    // January, where the discriminator date does not exist).
    if (dated) {
      await expect(page.getByText('Jan 2, 2026')).toBeVisible({
        timeout: 15_000,
      });
    }

    // Current-month cards are unaffected by the period switch — by design.
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Income this month'),
      /\+COP\s+100,000/,
    );
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Expenses this month'),
      /COP\s+30,000/,
    );

    // The container settles out of the busy state once the snapshot lands.
    await expect
      .poll(() => page.locator('div[aria-busy]').getAttribute('aria-busy'))
      .not.toBe('true');
  });

  test('logout clears the session cookie and lands on /login', async ({
    page,
  }) => {
    await freshUser(page);

    // Session cookie exists while authenticated.
    const sessionBefore = (await page.context().cookies()).filter(
      (c) => c.name === 'gm_session',
    );
    expect(sessionBefore).toHaveLength(1);

    await logout(page);
    await expect(page).toHaveURL(/\/login$/);

    // Confirmed logout: the session cookie is gone.
    const sessionAfter = (await page.context().cookies()).filter(
      (c) => c.name === 'gm_session',
    );
    expect(sessionAfter).toHaveLength(0);
  });

  test('tenant isolation: data created by one user never leaks into a second context', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const emailA = await registerUser(pageA);
      const emailB = await registerUser(pageB);
      expect(emailA).not.toBe(emailB);

      // Distinct sessions for distinct tenants.
      const cookieA = (await contextA.cookies()).find(
        (c) => c.name === 'gm_session',
      );
      const cookieB = (await contextB.cookies()).find(
        (c) => c.name === 'gm_session',
      );
      expect(cookieA).toBeDefined();
      expect(cookieB).toBeDefined();
      expect(cookieA!.value).not.toBe(cookieB!.value);

      // User A creates an account named "Solo-A" and a movement with a
      // distinctive note.
      await createAccountInUI(pageA, 'Solo-A');
      await seedFinancialData(pageA, {
        monthlyIncome: '1000',
        notePrefix: 'Solo-A',
      });

      // User B (isolated context) must never see A's data.
      await pageB.goto('/accounts');
      await expect(pageB.getByText('Solo-A', { exact: true })).toHaveCount(0);
      await pageB.goto('/dashboard');
      await expect(pageB.getByText('Solo-A', { exact: true })).toHaveCount(0);
      await pageB.goto('/movements');
      await expect(pageB.getByText('Solo-A-income', { exact: true })).toHaveCount(
        0,
      );

      // User B creates "Solo-B" + a distinctive note (and vice versa).
      await createAccountInUI(pageB, 'Solo-B');
      await seedFinancialData(pageB, {
        monthlyIncome: '2000',
        notePrefix: 'Solo-B',
      });

      // User A must never see B's data either.
      await pageA.goto('/accounts');
      await expect(pageA.getByText('Solo-B', { exact: true })).toHaveCount(0);
      // Positive control: A still sees its own "Solo-A" account.
      await expect(pageA.getByText('Solo-A', { exact: true })).toBeVisible();
      await pageA.goto('/dashboard');
      await expect(pageA.getByText('Solo-B', { exact: true })).toHaveCount(0);
      await pageA.goto('/movements');
      await expect(pageA.getByText('Solo-B-income', { exact: true })).toHaveCount(
        0,
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('i18n: switching locale from es to en via the nav toggle updates dashboard labels without a hard refresh', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Register in the default locale (en — Playwright's Accept-Language).
      await registerUser(page);
      await expect(page).toHaveURL(/\/dashboard$/);

      // Switch to Spanish through the REAL nav toggle (the production switch:
      // sets NEXT_LOCALE + router.refresh). Never mutate NEXT_LOCALE from the
      // test directly — the proxy persists it with `secure: true` under
      // `next start`, so manual cookie writes create Secure/non-Secure twin
      // cookies that race nondeterministically on reload.
      await page
        .getByRole('button', { name: /Switch to Spanish/i })
        .click();

      // GIVEN a logged-in user whose UI is in Spanish.
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.getByText('Ingresos este mes')).toBeVisible();

      // Marker survives a soft refresh but would be wiped by a hard reload.
      await page.evaluate(() => {
        (window as unknown as { __slice4NoHardRefresh?: string }).__slice4NoHardRefresh =
          'es-ok';
      });

      // WHEN the locale is switched back to en via the nav toggle.
      await page.getByRole('button', { name: /Cambiar a inglés/i }).click();

      // THEN dashboard labels update to English without a hard refresh.
      await expect(page.getByText('Income this month')).toBeVisible();
      await expect(page.getByText('Ingresos este mes')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveURL(/\/dashboard$/);
      const marker = await page.evaluate(
        () =>
          (window as unknown as { __slice4NoHardRefresh?: string })
            .__slice4NoHardRefresh === 'es-ok',
      );
      expect(marker).toBe(true);
    } finally {
      await context.close();
    }
  });
});