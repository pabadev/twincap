import { test, expect, type Page } from '@playwright/test';
import {
  registerUser,
  connectE2eDb,
  workspaceIdOf,
  accountIdOf,
} from './helpers';
import { TransferModel } from '../src/infrastructure/models/transfer';

/**
 * R15.3 §11 — Multimoneda (closing E2E).
 * Runs serially (workers: 1) against a local mongod + production `next start`.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e).
 *
 * Scenario under test: 190000 COP → 50 USD (5000 minor units) → the effective
 * exchange rate is DERIVED from the two real amounts — (190000 / 10^0) /
 * (5000 / 10^2) = 3800 COP/USD — never entered by the user. After creation the
 * rate must survive a reload because it RECOMPUTES from the stored amounts
 * (the stored effectiveExchangeRate exists for display/derived queries only).
 *
 * Amount formatting (Intl, en locale — verified against the app's
 * `formatAmount`): COP renders "COP 190,000" (NBSP between code and number),
 * USD renders "$50.00" (symbol), the derived rate renders "3,800".
 */

type Credentials = { email: string; password: string };

async function freshUser(page: Page): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: 'Password123!' };
}

/** Create an account with a chosen currency (0 initial balance) via /accounts. */
async function createAccountInUI(
  page: Page,
  name: string,
  currency: string,
): Promise<void> {
  await page.goto('/accounts');
  await page.getByRole('button', { name: /Add Account/i }).click();
  const dialog = page.getByRole('dialog', { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account Name').fill(name);
  await dialog.getByLabel('Currency').selectOption({ label: currency });
  await dialog.getByLabel('Initial Balance').fill('0');
  await dialog.getByRole('button', { name: /Create Account/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

test.describe('R15.3 §11 — Multimoneda', () => {
  test.describe.configure({ mode: 'serial' });

  test('190000 COP → 5000 USD minor derives FX 3,800 COP/USD, persists and reloads', async ({
    page,
  }) => {
    const { email } = await freshUser(page);

    // Destination account in USD (the seeded "Efectivo" is the COP source).
    await createAccountInUI(page, 'Dollar Account', 'USD');

    // Open the transfer form.
    await page.goto('/transfers');
    await page.getByRole('button', { name: 'Add Transfer' }).click();
    const dialog = page.getByRole('dialog', { name: /New Transfer/i });
    await expect(dialog).toBeVisible();

    await dialog
      .getByLabel('From Account')
      .selectOption({ label: 'Efectivo (COP)' });
    await dialog
      .getByLabel('To Account')
      .selectOption({ label: 'Dollar Account (USD)' });

    // The two REAL amounts (minor units): 190000 COP and 5000 USD-cents = 50 USD.
    await dialog.getByLabel(/Source Amount/).fill('190000');
    await dialog.getByLabel(/Dest Amount/).fill('5000');

    // TRA-3 (§11): the rate is DERIVED live from both amounts — the read-only
    // description renders the derived 3800 with NO rate input anywhere.
    await expect(
      dialog.getByText(/Each USD received costs 3,800 COP/),
    ).toBeVisible();
    await expect(dialog.getByText(/Effective rate/)).toBeVisible();
    // No independent rate field exists in the form (only the two real amounts).
    await expect(dialog.locator('input[name="rate"]')).toHaveCount(0);
    await expect(dialog.getByLabel(/effective rate/i)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Add Transfer' }).click();

    // Efectivo starts at 0, so the projected balance (−190,000) triggers the
    // R15.1 F5 confirm modal. §11 negative-balance policy: registering the
    // declared reality is allowed — confirm and proceed.
    const confirm = page.getByRole('dialog', {
      name: /Insufficient funds in the source account/i,
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Register anyway' }).click();
    await expect(
      page.getByRole('dialog', { name: /New Transfer/i }),
    ).toBeHidden();

    // The list shows the transfer with BOTH amounts and the derived rate.
    const row = page.locator('tr', { hasText: /Dollar Account \(USD\)/ }).first();
    await expect(row).toContainText(/Efectivo \(COP\)/);
    await expect(row).toContainText(/COP\s+190,000/);
    await expect(row).toContainText(/\$50\.00/);
    await expect(row).toContainText(/\(Effective rate: 3,800\)/);

    // Persistence: reload → the transfer and its derived rate are still shown
    // (the value recomputes from the stored amounts).
    await page.reload();
    const reloadedRow = page
      .locator('tr', { hasText: /Dollar Account \(USD\)/ })
      .first();
    await expect(reloadedRow).toContainText(/COP\s+190,000/);
    await expect(reloadedRow).toContainText(/\$50\.00/);
    await expect(reloadedRow).toContainText(/\(Effective rate: 3,800\)/);

    // DB-level: the stored transfer persists the derived rate and both real
    // amounts (the rate is derived data, never an independent input).
    await connectE2eDb();
    const workspaceId = await workspaceIdOf(email);
    const sourceAccountId = await accountIdOf(workspaceId, 'Efectivo');
    const transfer = await TransferModel.findOne({
      workspaceId,
      sourceAccountId,
    }).lean<{
      sourceAmount: number;
      sourceCurrency: string;
      destinationAmount: number;
      destinationCurrency: string;
      effectiveExchangeRate?: number;
    } | null>();
    expect(transfer).not.toBeNull();
    expect(transfer!.sourceAmount).toBe(190000);
    expect(transfer!.sourceCurrency).toBe('COP');
    expect(transfer!.destinationAmount).toBe(5000);
    expect(transfer!.destinationCurrency).toBe('USD');
    expect(transfer!.effectiveExchangeRate).toBe(3800);

    // Account balances reflect the transfer legs (source −190,000, dest +50 USD).
    await page.goto('/accounts');
    const efectivoRow = page.locator('tr', { hasText: 'Efectivo' }).first();
    await expect(efectivoRow).toContainText(/-COP\s+190,000/);
    const dollarRow = page
      .locator('tr', { hasText: 'Dollar Account' })
      .first();
    await expect(dollarRow).toContainText(/\$50\.00/);
  });
});