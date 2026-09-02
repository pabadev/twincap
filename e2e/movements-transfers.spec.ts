import { test, expect, type Page } from '@playwright/test';
import { registerUser } from './helpers';

/**
 * Slice 2 — Movements + Transfers + Payables (spec e2e-movements-transfers).
 * Runs serially (workers: 1) against a local mongod.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e), so labels are
 * asserted in English. Amounts are formatted by `formatAmount` (COP exponent 0,
 * currency code prefix, e.g. "COP 10,000") — asserted via regex/whitespace-safe
 * patterns because Intl inserts non-breaking spaces.
 *
 * Financial principles covered here (see AGENTS.md):
 *  - #1 transfer ≠ economic result: a transfer only moves money between own
 *    accounts; it must NOT appear in the dashboard income/expense cards.
 *  - Opening balances (`opening` link kind) are also excluded from result.
 */

type Credentials = { email: string; password: string };

async function freshUser(page: Page): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: 'Password123!' };
}

/** Wall-clock today as YYYY-MM-DD for date inputs. */
function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Create an account with a known initial balance via the /accounts dialog. */
async function createAccountInUI(
  page: Page,
  name: string,
  initialBalance: string,
): Promise<void> {
  await page.goto('/accounts');
  await page.getByRole('button', { name: /Add Account/i }).click();
  const dialog = page.getByRole('dialog', { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account Name').fill(name);
  await dialog.getByLabel('Initial Balance').fill(initialBalance);
  await dialog.getByRole('button', { name: /Create Account/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
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
  await expect(dialog).toBeHidden();
}

/**
 * Create a manual movement on the /movements page via the global movement
 * modal ("Add Movement" header button → "New Movement" dialog).
 * `type` is 'income' | 'expense'; `category` is the visible category label.
 */
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
  await dialog.getByLabel('Type').selectOption({ label: type === 'income' ? 'Income' : 'Expense' });
  await dialog.getByLabel('Category').selectOption({ label: category });
  await dialog.getByLabel('Amount').fill(amount);
  await dialog.getByLabel('Note').fill(note);
  await dialog.getByRole('button', { name: 'Add Movement' }).click();

  await expect(dialog).toBeHidden();
}

async function expectAccountBalance(
  page: Page,
  accountName: string,
  copAmount: string,
): Promise<void> {
  await page.goto('/accounts');
  const row = page.locator('tr', { hasText: accountName });
  // `formatAmount` renders "COP 10,000" (COP exponent 0, no decimals). We match
  // the numeric portion so the assertion is immune to Intl's non-breaking
  // space between the currency code and the number.
  await expect(row).toContainText(copAmount);
}

/**
 * Create a transfer between two COP accounts of the same currency via the
 * /transfers page ("Add Transfer" → "New Transfer" dialog).
 */
async function createTransferInUI(
  page: Page,
  {
    from,
    to,
    amount,
  }: {
    from: string;
    to: string;
    amount: string;
  },
): Promise<void> {
  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Add Transfer' }).click();
  const dialog = page.getByRole('dialog', { name: /New Transfer/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('From Account').selectOption({ label: `${from} (COP)` });
  await dialog.getByLabel('To Account').selectOption({ label: `${to} (COP)` });
  await dialog.getByLabel(/Source Amount/i).fill(amount);
  await dialog.getByRole('button', { name: 'Add Transfer' }).click();

  await expect(dialog).toBeHidden();
}

test.describe('Slice 2 — Movements + Transfers + Payables', () => {
  test.describe.configure({ mode: 'serial' });

  test('income increases and expense decreases the account balance', async ({
    page,
  }) => {
    await freshUser(page);

    // Income: Efectivo 0 → 10,000
    await createMovementInUI(page, {
      account: 'Efectivo',
      type: 'income',
      category: 'Salario',
      amount: '10000',
      note: 'slice2-income',
    });
    await expectAccountBalance(page, 'Efectivo', '10,000');

    // Expense: 10,000 → 7,000
    await createMovementInUI(page, {
      account: 'Efectivo',
      type: 'expense',
      category: 'Comida',
      amount: '3000',
      note: 'slice2-expense',
    });
    await expectAccountBalance(page, 'Efectivo', '7,000');
  });

  test('editing a movement updates its amount, date and category', async ({
    page,
  }) => {
    await freshUser(page);

    await createMovementInUI(page, {
      account: 'Efectivo',
      type: 'income',
      category: 'Salario',
      amount: '5000',
      note: 'slice2-edit-me',
    });

    // Confirm the movement is listed with amount +COP 5,000.
    await page.goto('/movements');
    const row = page.locator('tr', { hasText: 'slice2-edit-me' });
    await expect(row).toContainText(/\+?COP\s+5,000/);

    // Open the edit modal from the row's edit action.
    await row.getByRole('button', { name: /Edit/i }).click();
    const dialog = page.getByRole('dialog', { name: /Edit Movement/i });
    await expect(dialog).toBeVisible();

    // Change amount to 8,000 and category to Ventas, keep date = today.
    await dialog.getByLabel(/Amount \(COP\)/i).fill('8000');
    await dialog.getByLabel('Category').selectOption({ label: 'Ventas' });
    await dialog.getByLabel('Date').fill(todayInputValue());
    await dialog.getByRole('button', { name: /Save/i }).click();

    await expect(dialog).toBeHidden();

    // Balance reflects the edit (0 → 8,000).
    await expectAccountBalance(page, 'Efectivo', '8,000');

    // Row now shows the updated amount and category label.
    await page.goto('/movements');
    const editedRow = page.locator('tr', { hasText: 'slice2-edit-me' });
    await expect(editedRow).toContainText(/COP\s+8,000/);
    await expect(editedRow).toContainText('Ventas');
  });

  test('deleting a manual movement restores the pre-movement balance', async ({
    page,
  }) => {
    await freshUser(page);

    // Set the account to a known starting balance (opening movement).
    await setInitialBalanceInUI(page, 'Efectivo', '20000');
    await expectAccountBalance(page, 'Efectivo', '20,000');

    // Add an income movement on top → 30,000.
    await createMovementInUI(page, {
      account: 'Efectivo',
      type: 'income',
      category: 'Salario',
      amount: '10000',
      note: 'slice2-to-delete',
    });
    await expectAccountBalance(page, 'Efectivo', '30,000');

    // Delete the manual movement → back to 20,000.
    await page.goto('/movements');
    const row = page.locator('tr', { hasText: 'slice2-to-delete' });
    await row.getByRole('button', { name: /Delete/i }).click();

    const confirm = page.getByRole('dialog', {
      name: /Delete this movement/i,
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /^Delete$/i }).click();

    // The movement row disappears from the list.
    await expect(page.getByText('slice2-to-delete', { exact: true })).toHaveCount(0);

    // Balance is restored to the pre-movement value.
    await expectAccountBalance(page, 'Efectivo', '20,000');
  });

  test('transfer moves money between own accounts but never counts as economic result', async ({
    page,
  }) => {
    await freshUser(page);

    // Two COP accounts with known balances (opening movements — not income).
    await setInitialBalanceInUI(page, 'Efectivo', '100000');
    await createAccountInUI(page, 'Ahorros', '50000');
    await expectAccountBalance(page, 'Efectivo', '100,000');
    await expectAccountBalance(page, 'Ahorros', '50,000');

    // Transfer 30,000 Efectivo → Ahorros.
    await createTransferInUI(page, {
      from: 'Efectivo',
      to: 'Ahorros',
      amount: '30000',
    });

    // Balances reflect the transfer: Efectivo −30k, Ahorros +30k.
    await expectAccountBalance(page, 'Efectivo', '70,000');
    await expectAccountBalance(page, 'Ahorros', '80,000');

    // Dashboard: opening balances + the transfer are NOT income/expense.
    // With no manual movements, income and expense cards show COP 0.
    await page.goto('/dashboard');

    const incomeLabel = page.getByText('Income this month').first();
    await expect(
      incomeLabel.locator('xpath=following-sibling::p').first(),
    ).toContainText(/COP\s+0/);

    const expenseLabel = page.getByText('Expenses this month').first();
    await expect(
      expenseLabel.locator('xpath=following-sibling::p').first(),
    ).toContainText(/COP\s+0/);
  });

  test('creating a payable shows the correct pending amount (total − initial payment)', async ({
    page,
  }) => {
    await freshUser(page);

    await page.goto('/payables');
    await page.getByRole('button', { name: 'Add Payable' }).click();
    const dialog = page.getByRole('dialog', { name: /New Payable/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Counterparty (Vendor)').fill('Proveedor Alfa');
    await dialog.getByLabel('Total (COP)').fill('100000');
    await dialog.getByLabel('Paying Account').selectOption({ label: 'Efectivo (COP)' });
    await dialog.getByLabel('Initial Payment (COP)').fill('20000');
    // Anchored: the form also has "Due Date (optional)" — substring "Date"
    // would match both. The required date's accessible name is "Date*".
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    await dialog.getByRole('button', { name: 'Add Payable' }).click();

    await expect(dialog).toBeHidden();

    // The payable appears with pending = 100,000 − 20,000 = 80,000.
    const card = page.locator('div', { hasText: 'Proveedor Alfa' }).first();
    await expect(card).toContainText(/Pending:\s*COP\s+80,000/);
    await expect(card).toContainText(/COP\s+100,000/);
  });
});
