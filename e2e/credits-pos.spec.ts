import { test, expect, type Page } from '@playwright/test';
import { registerUser, confirmDialog } from './helpers';

/**
 * Slice 3 — Credits (received/granted) + POS (catalog/sales), spec
 * e2e-credits-pos. Runs serially (workers: 1) against a local mongod.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e), so labels are
 * asserted in English.
 *
 * Financial principles covered here (see AGENTS.md):
 *  - #7 credit granted: each abono first recovers the lent CAPITAL (kind
 *    creditGrantedAbono, NOT economic result); only the EXCESS over the
 *    remaining principal (creditGrantedAbonoInterest) is income. A write-off
 *    records an EXPENSE for the unrecovered capital and excludes the credit
 *    from the financial position (assets). A POS on-credit initial payment IS
 *    income (context-aware: kind creditGrantedAbono + context Business).
 *
 * Selector notes:
 *  - Anchored regexes are required: getByLabel substring-matches (e.g. "Date"
 *    would collide with the credit form's other date-like labels).
 *  - SaleForm line items (item-0 / qty-0 / price-0) have raw <label> siblings
 *    WITHOUT htmlFor — no accessible name — so they are driven by CSS id.
 *  - COP amounts render with a non-breaking space ("COP 1,000"); all amount
 *    regexes use \s to stay NBSP-safe.
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

/** Set the initial balance of "Efectivo" (no movements yet) via the dialog. */
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
  await dialog.getByRole('button', { name: 'Set Initial Balance' }).click();
  await expect(dialog).toBeHidden();
}

/** Assert an /accounts row shows the numeric COP amount (NBSP-safe). */
async function expectAccountBalance(
  page: Page,
  accountName: string,
  copAmount: string,
): Promise<void> {
  await page.goto('/accounts');
  const row = page.locator('tr', { hasText: accountName });
  await expect(row).toContainText(copAmount);
}

/**
 * Create a RECEIVED credit via /credits/received → "New Credit Received".
 * `options.installments` optional; when set, `installmentValue` is required.
 */
async function createReceivedCreditInUI(
  page: Page,
  {
    counterparty,
    principal,
    installments,
    installmentValue,
  }: {
    counterparty: string;
    principal: string;
    installments?: string;
    installmentValue?: string;
  },
): Promise<void> {
  await page.goto('/credits/received');
  await page.getByRole('button', { name: 'Add Credit' }).click();
  const dialog = page.getByRole('dialog', { name: /New Credit Received/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^Counterparty/).fill(counterparty);
  await dialog.getByLabel(/^Principal/).fill(principal);
  await dialog
    .getByLabel(/^Receiving Account/)
    .selectOption({ label: 'Efectivo (COP)' });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  if (installments) {
    await dialog.getByLabel(/^Installments/).fill(installments);
    await dialog.getByLabel(/^Installment value/).fill(installmentValue ?? '');
  }
  await dialog.getByRole('button', { name: /^Add Credit Received$/ }).click();

  await expect(dialog).toBeHidden();
}

/**
 * Create a GRANTED credit via /credits/granted → "New Credit Granted".
 * `options.installments` optional; when set, `installmentValue` is required.
 */
async function createGrantedCreditInUI(
  page: Page,
  {
    debtor,
    principal,
    installments,
    installmentValue,
  }: {
    debtor: string;
    principal: string;
    installments?: string;
    installmentValue?: string;
  },
): Promise<void> {
  await page.goto('/credits/granted');
  await page.getByRole('button', { name: 'Add Credit' }).click();
  const dialog = page.getByRole('dialog', { name: /New Credit Granted/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^Debtor/).fill(debtor);
  await dialog.getByLabel(/^Principal/).fill(principal);
  await dialog.getByLabel(/^Paying Account/).selectOption({ label: 'Efectivo (COP)' });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  if (installments) {
    await dialog.getByLabel(/^Installments/).fill(installments);
    await dialog.getByLabel(/^Installment value/).fill(installmentValue ?? '');
  }
  await dialog.getByRole('button', { name: /^Add Credit Granted$/ }).click();

  await expect(dialog).toBeHidden();
}

/** Expand a credit card by clicking its header (the counterparty text). */
async function expandCredit(page: Page, name: string): Promise<void> {
  const card = page.locator('div', { hasText: name }).first();
  await card.getByText(name, { exact: true }).click();
}

/**
 * Submit an abono on an expanded credit card. The AbonoForm lives inside the
 * card with ids amount-<creditId> / accountId-<creditId> / date-<creditId>.
 * Idempotent: opens the form only when it is not already open (the toggle
 * button label flips to "Cancel" once the form is open, so /^Add Abono$/ then
 * resolves to the form's submit button only).
 *
 * After submitting, closes the form so the NEXT submission mounts a FRESH
 * AbonoForm. IdempotencyField generates its key ONCE PER MOUNT — reusing the
 * same mounted form for a second abono is rejected by the server as
 * error.duplicateRequest (see src/components/ui/idempotency-field.tsx).
 */
async function submitAbonoInUI(
  page: Page,
  creditCard: ReturnType<Page['locator']>,
  amount: string,
): Promise<void> {
  const amountInput = creditCard.getByLabel(/^Amount/);
  if ((await amountInput.count()) === 0) {
    await creditCard.getByRole('button', { name: /^Add Abono$/ }).click();
    await expect(amountInput).toBeVisible();
  }
  await amountInput.fill(amount);
  await creditCard.getByLabel(/^Account/).selectOption({ label: 'Efectivo' });
  await creditCard.getByLabel(/^Date/).fill(todayInputValue());
  await creditCard.getByRole('button', { name: /^Add Abono$/ }).click();
  // The toggle label is "Cancel" while the form is open (auto-waits if it is
  // disabled during the in-flight submission). After the LAST abono the row
  // unmounts entirely (pending <= 0), so the click is conditional; closing
  // here guarantees the next call mounts a new form (fresh idempotency key).
  const cancelButton = creditCard.getByRole('button', { name: /^Cancel$/ });
  if ((await cancelButton.count()) > 0) {
    await cancelButton.click();
  }
  await expect(amountInput).toBeHidden();
}

/**
 * Create a catalog item via /pos/catalog → "New Catalog Item".
 * `type` defaults to 'product' (stock required); 'service' has no stock field.
 */
async function createCatalogItemInUI(
  page: Page,
  {
    name,
    unitPrice,
    stock,
    type = 'product',
  }: {
    name: string;
    unitPrice: string;
    stock?: string;
    type?: 'product' | 'service';
  },
): Promise<void> {
  await page.goto('/pos/catalog');
  await page.getByRole('button', { name: 'Add Item' }).click();
  const dialog = page.getByRole('dialog', { name: /New Catalog Item/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Unit Price/).fill(unitPrice);
  // Currency defaults to COP; type drives whether stock renders.
  if (type === 'service') {
    await dialog.getByLabel(/^Type/).selectOption({ label: 'Service' });
  } else {
    await dialog.getByLabel(/^Stock/).fill(stock ?? '0');
  }
  await dialog.getByRole('button', { name: /^Add Item$/ }).click();

  await expect(dialog).toBeHidden();
}

/** Dashboard value <p> following the given summary label <p>. */
function siblingValue(page: Page, label: string) {
  return page
    .getByText(label)
    .first()
    .locator('xpath=following-sibling::p')
    .first();
}

test.describe('Slice 3 — Credits + POS', () => {
  test.describe.configure({ mode: 'serial' });

  test('received credit shows principal and pending = principal', async ({
    page,
  }) => {
    await freshUser(page);

    await createReceivedCreditInUI(page, {
      counterparty: 'Banco Acme',
      principal: '100000',
    });

    // /credits/received renders principal and pending = principal (100,000).
    const card = page.locator('div', { hasText: 'Banco Acme' }).first();
    await expect(card).toContainText(/COP\s+100,000/);
    await expect(card).toContainText(/Pending:\s*COP\s+100,000/);
  });

  test('received credit abono reduces the pending amount', async ({ page }) => {
    await freshUser(page);

    await createReceivedCreditInUI(page, {
      counterparty: 'Cooperativa Beta',
      principal: '100000',
    });

    const card = page.locator('div', { hasText: 'Cooperativa Beta' }).first();
    await expandCredit(page, 'Cooperativa Beta');

    // Abono of 30,000 → pending drops 100,000 → 70,000.
    await submitAbonoInUI(page, card, '30000');
    await expect(card).toContainText(/Pending:\s*COP\s+70,000/);
    await expect(card).toContainText(/COP\s+100,000/);
  });

  test('granted credit: abono split renders capital + interest; only interest is income (principle #7)', async ({
    page,
  }) => {
    await freshUser(page);

    // Principal 100,000 in 2 installments of 55,000 → total to pay 110,000.
    await createGrantedCreditInUI(page, {
      debtor: 'Deudor Demo',
      principal: '100000',
      installments: '2',
      installmentValue: '55000',
    });

    // List shows principal, installments and pending (= totalToPay).
    const card = page.locator('div', { hasText: 'Deudor Demo' }).first();
    await expect(card).toContainText(/COP\s+100,000/);
    await expect(card).toContainText(/2\s+installment\(s\)/);
    await expect(card).toContainText(/Pending:\s*COP\s+110,000/);

    // Abono 1: 55,000 → all capital recovery (principal 100,000 > 55,000).
    await expandCredit(page, 'Deudor Demo');
    await submitAbonoInUI(page, card, '55000');
    await expect(card).toContainText(/Pending:\s*COP\s+55,000/);

    // Abono 2: 55,000 exceeds the remaining capital (45,000) → split renders
    // principal 45,000 + interest 10,000 columns (credits-granted-list).
    await submitAbonoInUI(page, card, '55000');
    await expect(card).toContainText('Paid in full');

    const abonoRows = card.locator('tbody tr');
    await expect(abonoRows).toHaveCount(2);
    await expect(abonoRows.nth(0)).toContainText(/COP\s+55,000/);
    await expect(abonoRows.nth(1)).toContainText(/COP\s+45,000/);
    await expect(abonoRows.nth(1)).toContainText(/COP\s+10,000/);

    // Financial principle #7: only the interest portion is income. Dashboard
    // income = 10,000 (interest); expenses = 0 (principal outflow is a
    // financing flow, not an expense; capital recovery is not income).
    await page.goto('/dashboard');
    await expect(siblingValue(page, 'Income this month')).toContainText(
      /COP\s+10,000/,
    );
    await expect(siblingValue(page, 'Expenses this month')).toContainText(
      /COP\s+0/,
    );
  });

  test('write-off renders the danger badge and excludes the credit from financial position assets', async ({
    page,
  }) => {
    await freshUser(page);

    // Start from a known position: Efectivo opening 300,000.
    await setInitialBalanceInUI(page, 'Efectivo', '300000');
    await expectAccountBalance(page, 'Efectivo', '300,000');

    // Grant 100,000 → receivable becomes an asset: 300,000 (200,000 cash +
    // 100,000 receivable).
    await createGrantedCreditInUI(page, {
      debtor: 'Deudor Incobrable',
      principal: '100000',
    });
    await page.goto('/dashboard');
    await expect(siblingValue(page, 'Assets')).toContainText(/COP\s+300,000/);

    // Write off → the receivable is excluded from assets and the unrecovered
    // capital is recorded as an expense: assets 100,000; expenses 100,000.
    await page.goto('/credits/granted');
    const card = page.locator('div', { hasText: 'Deudor Incobrable' }).first();
    await expandCredit(page, 'Deudor Incobrable');
    await card.getByRole('button', { name: /Write off/i }).click();
    await confirmDialog(page, { title: /Write off/i, confirm: /^Write off$/i });

    // Danger badge "Written off" renders in the list. Scoped to a <span> so the
    // Status filter's "Written off" <option> can't satisfy it, and it renders
    // only AFTER the action persists + router.refresh — this assertion is what
    // synchronizes the follow-up dashboard read.
    await expect(
      page.locator('span', { hasText: /^Written off$/ }),
    ).toBeVisible();

    // Position: credit excluded from assets (pending stays > 0 but writtenOff
    // skips it); expense recorded for the unrecovered principal.
    await page.goto('/dashboard');
    await expect(siblingValue(page, 'Assets')).toContainText(/COP\s+100,000/);
    await expect(siblingValue(page, 'Expenses this month')).toContainText(
      /COP\s+100,000/,
    );
  });

  test('POS: catalog item appears and a paid-in-full sale records income', async ({
    page,
  }) => {
    await freshUser(page);

    await createCatalogItemInUI(page, {
      name: 'Widget Test',
      unitPrice: '10000',
      stock: '50',
    });

    // Item appears in /pos/catalog.
    const itemCard = page.locator('div', { hasText: 'Widget Test' }).first();
    await expect(itemCard).toContainText('Product');
    await expect(itemCard).toContainText('Stock: 50');
    await expect(itemCard).toContainText(/COP\s+10,000/);

    // Sale: 2 × 10,000 = 20,000, paid in full on Efectivo.
    await page.goto('/pos/sales');
    await page.getByRole('button', { name: 'New Sale' }).click();
    const dialog = page.getByRole('dialog', { name: /Create Sale/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: 'Paid in Full' });
    await dialog.getByLabel(/^Account/).selectOption({ label: 'Efectivo' });
    await dialog.getByLabel(/^Client/).selectOption({ label: 'General Client' });
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    // Line items have no accessible label (raw <label> without htmlFor) — ids.
    await dialog.locator('#item-0').selectOption({ label: 'Widget Test (Product)' });
    await expect(dialog.locator('#price-0')).toHaveValue('10000');
    await dialog.locator('#qty-0').fill('2');
    await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+20,000/);
    await dialog.getByRole('button', { name: /^Create Sale$/ }).click();
    await expect(dialog).toBeHidden();

    // /pos/sales shows the sale.
    const saleCard = page.locator('div', { hasText: 'Widget Test' }).first();
    await expect(saleCard).toContainText('Paid in Full');
    await expect(saleCard).toContainText(/COP\s+20,000/);

    // Income movement recorded on the account (Efectivo 0 → 20,000).
    await expectAccountBalance(page, 'Efectivo', '20,000');

    // Stock decremented (POS-3): 50 − 2 = 48.
    await page.goto('/pos/catalog');
    await expect(
      page.locator('div', { hasText: 'Widget Test' }).first(),
    ).toContainText('Stock: 48');
  });

  test('POS: on-credit sale creates a linked granted credit and counts the initial payment as income', async ({
    page,
  }) => {
    await freshUser(page);

    await createCatalogItemInUI(page, {
      name: 'Servicio Test',
      unitPrice: '10000',
      type: 'service',
    });

    await page.goto('/pos/sales');
    await page.getByRole('button', { name: 'New Sale' }).click();
    const dialog = page.getByRole('dialog', { name: /Create Sale/i });
    await expect(dialog).toBeVisible();

    // On-credit requires a real client: create one inline from the sale form.
    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: 'On Credit' });
    await dialog.getByLabel(/^Account/).selectOption({ label: 'Efectivo' });
    await dialog.getByRole('button', { name: /Create client/i }).click();
    const clientDialog = page.getByRole('dialog', { name: /New client/i });
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel(/^Name/).fill('Cliente POS');
    await clientDialog.getByRole('button', { name: /^New Client$/ }).click();
    await expect(clientDialog).toBeHidden();

    // Total 10,000, initial payment 4,000 → pending 6,000.
    await dialog.getByLabel(/^Initial payment/).fill('4000');
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    await dialog.locator('#item-0').selectOption({ label: 'Servicio Test (Service)' });
    await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+10,000/);
    await dialog.getByRole('button', { name: /^Create Sale$/ }).click();
    await expect(dialog).toBeHidden();

    // /pos/sales: on-credit badge, client, initial payment and pending.
    const saleCard = page.locator('div', { hasText: 'Cliente POS' }).first();
    await expect(saleCard).toContainText('On Credit');
    await expect(saleCard).toContainText(/COP\s+10,000/);
    await expect(saleCard).toContainText(/Initial payment:\s*COP\s+4,000/);
    await expect(saleCard).toContainText(/Pending:\s*COP\s+6,000/);

    // A linked granted credit exists with pending = total − initial.
    await page.goto('/credits/granted');
    const creditCard = page.locator('div', { hasText: 'Cliente POS' }).first();
    await expect(creditCard).toContainText(/COP\s+10,000/);
    await expect(creditCard).toContainText(/Pending:\s*COP\s+6,000/);

    // The initial payment is income (context-aware, principle #7): Efectivo
    // 0 → 4,000.
    await expectAccountBalance(page, 'Efectivo', '4,000');
  });
});