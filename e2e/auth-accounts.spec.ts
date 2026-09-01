import { test, expect, type Page } from '@playwright/test';
import {
  registerUser,
  login,
  logout,
  clearRateLimits,
  confirmDialog,
} from './helpers';

/**
 * Slice 1 — Auth + Accounts (spec e2e-auth-accounts).
 * Runs serially (workers: 1) against a local mongod.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e), so labels are
 * asserted in English.
 */

const beforeLoanRegister = async (
  page: Page,
): Promise<{ email: string; password: string }> => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: 'Password123!' };
};

async function createAccountInUI(
  page: Page,
  name: string,
  initialBalance = '0',
): Promise<void> {
  await page.goto('/accounts');
  await page.getByRole('button', { name: /Add Account/i }).click();
  const dialog = page.getByRole('dialog', { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account Name').fill(name);
  await dialog.getByLabel('Initial Balance').fill(initialBalance);
  await dialog.getByRole('button', { name: /Create Account/i }).click();
  // Modal form submits, panel refreshes and closes on success.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

test.describe('Slice 1 — Auth + Accounts', () => {
  test.describe.configure({ mode: 'serial' });

  test('register a new user and land on /dashboard with the seeded Efectivo account', async ({
    page,
  }) => {
    const email = await registerUser(page);
    expect(email).toMatch(/e2e-.*@test\.local/);

    await expect(page).toHaveURL(/\/dashboard$/);
    // Seed account "Efectivo" (COP, fixed) renders as a dashboard card heading
    // with a COP currency label.
    await expect(
      page.getByRole('heading', { name: 'Efectivo' }),
    ).toBeVisible();
    await expect(page.getByText('COP', { exact: true }).first()).toBeVisible();
  });

  test('login a registered user works and redirects to /dashboard', async ({
    page,
  }) => {
    const { email, password } = await beforeLoanRegister(page);
    await logout(page);

    await login(page, { email, password });
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: 'Efectivo' }),
    ).toBeVisible();
  });

  test('login with a wrong password shows an error and does NOT redirect', async ({
    page,
  }) => {
    const { email } = await beforeLoanRegister(page);
    await logout(page);

    await page.goto('/login');
    await page.getByLabel(/^Email/i).fill(email);
    await page.getByLabel(/^Password/i).fill('WrongPassword999!');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // Auth form error div (bg-danger/10) with the credential error.
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rate limiter blocks the 4th registration within 15 minutes', async ({
    page,
  }) => {
    // Clear the shared register:unknown counter ONCE, then submit 3 allowed
    // registrations with matching passwords followed by a 4th (blocked).
    await clearRateLimits();

    for (let i = 0; i < 3; i += 1) {
      await page.goto('/register');
      const email = `e2e-${Date.now()}-rl-${i + 1}@test.local`;
      await page.getByLabel(/^Email/i).fill(email);
      await page.getByLabel(/^Password/i).fill('Password123!');
      await page.getByLabel(/^Confirm Password/i).fill('Password123!');
      await page.getByRole('button', { name: /Register/i }).click();
      // These 3 attempts are allowed → redirect to dashboard.
      await page.waitForURL('**/dashboard');
    }

    // 4th attempt → blocked, error renders, no redirect, user NOT created.
    await page.goto('/register');
    const blockedEmail = `e2e-${Date.now()}-rl-4@test.local`;
    await page.getByLabel(/^Email/i).fill(blockedEmail);
    await page.getByLabel(/^Password/i).fill('Password123!');
    await page.getByLabel(/^Confirm Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Register/i }).click();

    await expect(
      page.getByText(
        'Too many registration attempts. Please try again later.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('create an account via AccountForm', async ({ page }) => {
    await beforeLoanRegister(page);
    await createAccountInUI(page, 'Banco Alfa');
  });

  test('rename an account via RenameAccount', async ({ page }) => {
    await beforeLoanRegister(page);
    await createAccountInUI(page, 'Ahorros Beta');

    const row = page.locator('tr', { hasText: 'Ahorros Beta' });
    await row.getByRole('button', { name: /Edit/i }).click();

    const dialog = page.getByRole('dialog', { name: /Rename Account/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Account Name').fill('Ahorros Gamma');
    await dialog.getByRole('button', { name: /Save/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Ahorros Gamma', { exact: true })).toBeVisible();
    await expect(page.getByText('Ahorros Beta', { exact: true })).toHaveCount(0);
  });

  test('set an initial balance on an existing account', async ({ page }) => {
    await beforeLoanRegister(page);
    await createAccountInUI(page, 'Caja Roja');

    const row = page.locator('tr', { hasText: 'Caja Roja' });
    await row.getByRole('button', { name: /Set Initial Balance/i }).click();

    const dialog = page.getByRole('dialog', {
      name: /Set Initial Balance/i,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Balance to set').fill('5000');
    await dialog
      .getByRole('button', { name: 'Set Initial Balance' })
      .click();

    await expect(dialog).toBeHidden();
    // Balance reflects in the list (COP 5,000 in the en locale).
    const refreshedRow = page.locator('tr', { hasText: 'Caja Roja' });
    await expect(refreshedRow).toContainText('5,000');
  });

  test('delete an account (no manual movements) via DeleteAccount confirm', async ({
    page,
  }) => {
    await beforeLoanRegister(page);
    await createAccountInUI(page, 'Billetera Aux');

    const row = page.locator('tr', { hasText: 'Billetera Aux' });
    await row.getByRole('button', { name: /Delete/i }).click();

    await confirmDialog(page, {
      title: /Delete this account\?/i,
      confirm: /^Delete$/i,
    });

    await expect(
      page.getByText('Billetera Aux', { exact: true }),
    ).toHaveCount(0);
  });
});
