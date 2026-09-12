import { test, expect, type Page } from '@playwright/test';
import { registerUser, waitForSnapshotValue } from './helpers';

/**
 * R15.3 §11 — Saldo negativo (closing E2E).
 * Runs serially (workers: 1) against a local mongod + production `next start`.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e).
 *
 * Scenario under test: a manual EXPENSE that exceeds the account balance is
 * REGISTERED (no blocking validation) and the account is allowed to show a
 * negative balance everywhere it is derived:
 *  - /movements row: the expense is stored with the U+2212 prefix ("−"),
 *    formatAmount renders "−COP 10,000" (NBSP between code and number).
 *  - /accounts balance: Intl renders the negative as ASCII minus → "-COP 5,000".
 *  - dashboard Total Balance: same derived negative value.
 * The balance comes from the signed movements only (opening 5,000 − expense
 * 10,000 = −5,000); there is no stored "balance" field to go stale.
 */

type Credentials = { email: string; password: string };

async function freshUser(page: Page): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: 'Password123!' };
}

/** The <p> value node that follows a summary-card label (mirrors slice 4). */
function summaryValue(page: Page, label: string): ReturnType<Page['locator']> {
  return page
    .getByText(label)
    .first()
    .locator('xpath=following-sibling::p')
    .first();
}

/** Set the initial balance of an account that has no movements yet. */
async function setInitialBalanceInUI(
  page: Page,
  accountName: string,
  amount: string,
): Promise<void> {
  await page.goto('/accounts');
  const row = page.locator('tr', { hasText: accountName });
  await row.getByRole('button', { name: /Set Initial Balance/i }).click();
  const dialog = page.getByRole('dialog', { name: /Set Initial Balance/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Balance to set').fill(amount);
  await dialog
    .getByRole('button', { name: 'Set Initial Balance' })
    .click();
  // Generous settle budget: on a loaded dev machine the server action can take
  // longer than the default 15s (production next start + mongod under load).
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

/** Create a manual movement on the /movements page via the global modal. */
async function createMovementInUI(
  page: Page,
  {
    account,
    type,
    category,
    amount,
    note,
  }: {
    account: string;
    type: 'income' | 'expense';
    category: string;
    amount: string;
    note: string;
  },
): Promise<void> {
  await page.goto('/movements');
  await page.getByRole('button', { name: 'Add Movement' }).click();
  const dialog = page.getByRole('dialog', { name: /New Movement/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Account').selectOption({ label: `${account} (COP)` });
  await dialog
    .getByLabel('Type')
    .selectOption({ label: type === 'income' ? 'Income' : 'Expense' });
  await dialog.getByLabel('Category').selectOption({ label: category });
  await dialog.getByLabel('Amount').fill(amount);
  await dialog.getByLabel('Note').fill(note);
  await dialog.getByRole('button', { name: 'Add Movement' }).click();

  await expect(dialog).toBeHidden();
}

test.describe('R15.3 §11 — Saldo negativo', () => {
  test.describe.configure({ mode: 'serial' });

  test('an expense above the balance is registered; negative balance is shown consistently', async ({
    page,
  }) => {
    await freshUser(page);

    // Seed a modest positive opening: COP 5,000 on the default Efectivo account.
    await setInitialBalanceInUI(page, 'Efectivo', '5000');
    await expect(
      page.locator('tr', { hasText: 'Efectivo' }).first(),
    ).toContainText(/COP\s+5,000/);

    // Register an EXPENSE ABOVE the balance (COP 10,000 vs 5,000 available).
    // §11: the movement is recorded as reality — no "insufficient funds"
    // blocking validation exists for manual movements.
    await createMovementInUI(page, {
      account: 'Efectivo',
      type: 'expense',
      category: 'Comida',
      amount: '10000',
      note: 'slice7-negative',
    });

    // /movements: the expense row shows "−COP 10,000" (U+2212 prefix from the
    // list, NBSP-safe regex, expense badge, category, note). NOTE: the row has
    // no account cell — the movements list renders date, amount, category,
    // note, type (no per-row account column).
    const movementRow = page.locator('tr', { hasText: 'slice7-negative' });
    await expect(movementRow).toContainText(/[−-]COP\s+10,000/);
    await expect(movementRow).toContainText('Expense');
    await expect(movementRow).toContainText('Comida');

    // /accounts: the derived balance is NEGATIVE — "-COP 5,000" (Intl ASCII
    // minus). The value is derived from signed movements; nothing is blocked.
    await page.goto('/accounts');
    const efectivoRow = page.locator('tr', { hasText: 'Efectivo' }).first();
    await expect(efectivoRow).toContainText(/-COP\s+5,000/);

    // Persistence: a full reload still shows the derived negative balance.
    await page.reload();
    await expect(efectivoRow).toContainText(/-COP\s+5,000/);

    // Dashboard Total Balance derives the same negative value from movements.
    await page.goto('/dashboard');
    await waitForSnapshotValue(
      page,
      summaryValue(page, 'Total Balance'),
      /[-−]COP\s+5,000/,
    );
  });
});