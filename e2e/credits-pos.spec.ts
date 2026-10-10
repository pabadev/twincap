import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  registerUser,
  confirmDialog,
  confirmMoneyAction,
  expectNoSaleConfirmationDialog,
  connectE2eDb,
  workspaceIdOf,
  accountIdOf,
  openingMovementsOf,
} from "./helpers";

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
  return { email, password: "Password123!" };
}

/** Wall-clock today as YYYY-MM-DD for date inputs. */
function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Set the initial balance of "Efectivo" (no movements yet) via the dialog. */
async function setInitialBalanceInUI(
  page: Page,
  accountName: string,
  amount: string,
): Promise<void> {
  await page.goto("/accounts");
  const row = page.locator("[data-id]", { hasText: accountName });
  await row.getByRole("button", { name: /Set Initial Balance/i }).click();
  const dialog = page.getByRole("dialog", { name: /Set Initial Balance/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Balance to set").fill(amount);
  await dialog.getByRole("button", { name: "Set Initial Balance" }).click();
  // UX-6: the informed-confirmation dialog opens over the form — confirm it.
  await confirmMoneyAction(page);
  await expect(dialog).toBeHidden();
  await expect(page.locator("[aria-live='polite']").getByText(/Initial balance set/i)).toHaveCount(
    1,
  );
}

/** Assert an /accounts row shows the numeric COP amount (NBSP-safe). */
async function expectAccountBalance(
  page: Page,
  accountName: string,
  copAmount: string,
): Promise<void> {
  await page.goto("/accounts");
  const row = page.locator("[data-id]", { hasText: accountName });
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
  await page.goto("/credits/received");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const dialog = page.getByRole("dialog", { name: /New Credit Received/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^Counterparty/).fill(counterparty);
  await dialog.getByLabel(/^(Capital|Principal)/i).fill(principal);
  await dialog.getByLabel(/^Receiving Account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  if (installments) {
    await dialog.getByLabel(/^Installments/).fill(installments);
    await dialog.getByLabel(/^Installment value/).fill(installmentValue ?? "");
  }
  await dialog.getByRole("button", { name: /^Add Credit Received$/ }).click();

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
  await page.goto("/credits/granted");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const dialog = page.getByRole("dialog", { name: /New Credit Granted/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/^Debtor/).fill(debtor);
  await dialog.getByLabel(/^(Capital|Principal)/i).fill(principal);
  await dialog.getByLabel(/^Paying Account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  if (installments) {
    await dialog.getByLabel(/^Installments/).fill(installments);
    await dialog.getByLabel(/^Installment value/).fill(installmentValue ?? "");
  }
  await dialog.getByRole("button", { name: /^Add Credit Granted$/ }).click();

  await expect(dialog).toBeHidden();
}

/** Expand a credit card by clicking its header (the counterparty text). */
async function expandCredit(page: Page, name: string): Promise<void> {
  const card = page.locator("div", { hasText: name }).first();
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
  creditCard: ReturnType<Page["locator"]>,
  amount: string,
): Promise<void> {
  const amountInput = creditCard.getByLabel(/^Amount/);
  if ((await amountInput.count()) === 0) {
    await creditCard.getByRole("button", { name: /^Add Abono$/ }).click();
    await expect(amountInput).toBeVisible();
  }
  await amountInput.fill(amount);
  await creditCard.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await creditCard.getByLabel(/^Date/).fill(todayInputValue());
  await creditCard.getByRole("button", { name: /^Add Abono$/ }).click();
  // UX-6: the informed-confirmation dialog opens INSIDE the card. Its Cancel
  // button collides with the header toggle ("Cancel") for strict-mode
  // locators, so it MUST be confirmed BEFORE the toggle-count logic below.
  await confirmMoneyAction(page);
  // router.refresh() after the abono re-renders the list — with sidebar
  // prefetch disabled the (main) tree remounts, so stale locators must be
  // re-resolved against the fresh DOM before further interaction.
  // Post-refresh remount race (CI, deterministic when timing shifts): a
  // Cancel click fired while the (main) tree is being replaced is swallowed
  // (click lands on a replaced node, the form stays open). Self-correcting
  // retry: re-click the CURRENT toggle and assert closure in the same pass —
  // when the credit became fully paid the row unmounts instead (count → 0)
  // and the assertion passes on the re-resolved (absent) input.
  await expect(async () => {
    const amountInput = creditCard.getByLabel(/^Amount/);
    const cancelButton = creditCard.getByRole("button", { name: /^Cancel$/ });
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
    }
    await expect(amountInput).toBeHidden();
  }).toPass({ timeout: 20_000 });
}

/**
 * Create a catalog item via /pos/catalog → "Add product or service" (C12-4
 * renamed the catalog UI from "Add Item" to the explicit products & services
 * terminology; the dialog submit button is "Add to catalog").
 * `type` defaults to 'product' (stock required); 'service' has no stock field.
 */
async function createCatalogItemInUI(
  page: Page,
  {
    name,
    unitPrice,
    stock,
    type = "product",
  }: {
    name: string;
    unitPrice: string;
    stock?: string;
    type?: "product" | "service";
  },
): Promise<void> {
  await page.goto("/pos/catalog");
  await page.getByRole("button", { name: "Add product or service" }).click();
  const dialog = page.getByRole("dialog", { name: /New product or service/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/product or service name/i).fill(name);
  // Ronda Producto 1: guided kind + neutral selects (no implicit defaults).
  // Currency first: the Unit Price label renders the chosen currency.
  await dialog
    .getByLabel("Type")
    .selectOption({ label: type === "service" ? "Service" : "Product" });
  await dialog.getByLabel("Currency").selectOption({ label: "COP" });
  await dialog.getByLabel(/^Unit Price/).fill(unitPrice);
  if (type !== "service") {
    await dialog.getByLabel("Sale unit").selectOption({ label: "unit" });
    await dialog.getByLabel("Product use").selectOption({ label: "Sellable product" });
    await dialog.getByLabel(/^Opening stock/).fill(stock ?? "0");
  }
  await dialog.getByRole("button", { name: /^Add to catalog$/ }).click();

  await expect(dialog).toBeHidden();
}

/**
 * C12-3c: add a catalog item to the sale cart via the single search combobox
 * (the per-row `#item-0` <Select> of the pre-C12-3 form no longer exists).
 * Selecting an option adds the item at qty 1 with its unit price prefilled.
 */
async function addSaleItemViaSearch(page: Page, dialog: Locator, itemName: string): Promise<void> {
  await dialog.locator("#item-search").fill(itemName);
  await dialog.getByRole("option", { name: new RegExp(itemName) }).click();
}

/** Dashboard value <p> following the given summary label <p>. */
function siblingValue(page: Page, label: string) {
  return page.getByText(label).first().locator("xpath=following-sibling::p").first();
}

test.describe("Slice 3 — Credits + POS", () => {
  test.describe.configure({ mode: "serial" });

  test("received credit shows principal and pending = principal", async ({ page }) => {
    await freshUser(page);

    await createReceivedCreditInUI(page, {
      counterparty: "Banco Acme",
      principal: "100000",
    });

    // /credits/received renders principal and pending = principal (100,000).
    const card = page.locator("div", { hasText: "Banco Acme" }).first();
    await expect(card).toContainText(/COP\s+100,000/);
    await expect(card).toContainText(/Pending:\s*COP\s+100,000/);
  });

  test("received credit abono reduces the pending amount", async ({ page }) => {
    await freshUser(page);

    await createReceivedCreditInUI(page, {
      counterparty: "Cooperativa Beta",
      principal: "100000",
    });

    const card = page.locator("div", { hasText: "Cooperativa Beta" }).first();
    await expandCredit(page, "Cooperativa Beta");

    // Abono of 30,000 → pending drops 100,000 → 70,000.
    await submitAbonoInUI(page, card, "30000");
    await expect(card).toContainText(/Pending:\s*COP\s+70,000/);
    await expect(card).toContainText(/COP\s+100,000/);
  });

  test("mark as paid requires choosing the payment account in the confirmation dialog (H-06)", async ({
    page,
  }) => {
    await freshUser(page);

    await createReceivedCreditInUI(page, {
      counterparty: "Acreedor Dialogo",
      principal: "100000",
    });

    const card = page.locator("div", { hasText: "Acreedor Dialogo" }).first();
    await expandCredit(page, "Acreedor Dialogo");

    // The trigger opens a confirmation dialog with a MANDATORY account select.
    await card.getByRole("button", { name: /Mark as paid/i }).click();
    const dialog = page.getByRole("dialog", { name: /Mark as paid/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^Account/)).toBeVisible();

    // Confirm without selecting → inline error, dialog stays open (H-06).
    await dialog.getByRole("button", { name: /^Mark as paid$/ }).click();
    await expect(dialog.getByText("You must select an account for this payment")).toBeVisible();

    // Choose Efectivo and confirm → the credit is paid in full.
    await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo (COP)" });
    await dialog.getByRole("button", { name: /^Mark as paid$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(card).toContainText("Paid in full");
  });

  test("granted credit: abono split renders capital + interest; only interest is income (principle #7)", async ({
    page,
  }) => {
    await freshUser(page);

    // Principal 100,000 in 2 installments of 55,000 → total to pay 110,000.
    await createGrantedCreditInUI(page, {
      debtor: "Deudor Demo",
      principal: "100000",
      installments: "2",
      installmentValue: "55000",
    });

    // List shows principal, installments and pending (= totalToPay).
    const card = page.locator("div", { hasText: "Deudor Demo" }).first();
    await expect(card).toContainText(/COP\s+100,000/);
    await expect(card).toContainText(/2\s+installment\(s\)/);
    await expect(card).toContainText(/Pending:\s*COP\s+110,000/);

    // Abono 1: 55,000 → all capital recovery (principal 100,000 > 55,000).
    await expandCredit(page, "Deudor Demo");
    await submitAbonoInUI(page, card, "55000");
    await expect(card).toContainText(/Pending:\s*COP\s+55,000/);

    // Abono 2: 55,000 exceeds the remaining capital (45,000) → split renders
    // principal 45,000 + interest 10,000 columns (credits-granted-list).
    await submitAbonoInUI(page, card, "55000");
    await expect(card).toContainText("Paid in full");

    const abonoRows = card.locator("tbody tr");
    await expect(abonoRows).toHaveCount(2);
    await expect(abonoRows.nth(0)).toContainText(/COP\s+55,000/);
    await expect(abonoRows.nth(1)).toContainText(/COP\s+45,000/);
    await expect(abonoRows.nth(1)).toContainText(/COP\s+10,000/);

    // Financial principle #7: only the interest portion is income. Dashboard
    // income = 10,000 (interest); expenses = 0 (principal outflow is a
    // financing flow, not an expense; capital recovery is not income).
    await page.goto("/dashboard");
    await expect(siblingValue(page, "Income this month")).toContainText(/COP\s+10,000/);
    await expect(siblingValue(page, "Expenses this month")).toContainText(/COP\s+0/);
  });

  test("write-off renders the danger badge and excludes the credit from financial position assets", async ({
    page,
  }) => {
    const { email } = await freshUser(page);

    // Start from a known position: Efectivo opening 300,000.
    await setInitialBalanceInUI(page, "Efectivo", "300000");
    await connectE2eDb();
    const workspaceId = await workspaceIdOf(email);
    const accountId = await accountIdOf(workspaceId, "Efectivo");
    const openings = await openingMovementsOf(workspaceId, accountId);
    expect(openings).toEqual([{ amount: 300_000 }]);
    await expectAccountBalance(page, "Efectivo", "300,000");

    // Grant 100,000 → receivable becomes an asset: 300,000 (200,000 cash +
    // 100,000 receivable).
    await createGrantedCreditInUI(page, {
      debtor: "Deudor Incobrable",
      principal: "100000",
    });
    await page.goto("/dashboard");
    await expect(siblingValue(page, "Assets")).toContainText(/COP\s+300,000/);

    // Write off → the receivable is excluded from assets and the unrecovered
    // capital is recorded as an expense: assets 100,000; expenses 100,000.
    await page.goto("/credits/granted");
    const card = page.locator("div", { hasText: "Deudor Incobrable" }).first();
    await expandCredit(page, "Deudor Incobrable");
    await card.getByRole("button", { name: /Write off/i }).click();
    await confirmDialog(page, { title: /Write off/i, confirm: /^Write off$/i });

    // Danger badge "Written off" renders in the list. Scoped to a <span> so the
    // Status filter's "Written off" <option> can't satisfy it, and it renders
    // only AFTER the action persists + router.refresh — this assertion is what
    // synchronizes the follow-up dashboard read.
    await expect(page.locator("span", { hasText: /^Written off$/ })).toBeVisible();

    // Position: credit excluded from assets (pending stays > 0 but writtenOff
    // skips it); expense recorded for the unrecovered principal.
    await page.goto("/dashboard");
    await expect(siblingValue(page, "Assets")).toContainText(/COP\s+100,000/);
    await expect(siblingValue(page, "Expenses this month")).toContainText(/COP\s+100,000/);
  });

  test("POS: catalog item appears and a paid-in-full sale records income", async ({ page }) => {
    await freshUser(page);

    await createCatalogItemInUI(page, {
      name: "Widget Test",
      unitPrice: "10000",
      stock: "50",
    });

    // Item appears in /pos/catalog. The Ronda Producto 1 card shows a
    // "Sellable product" badge and a unit-aware stock row ("50 unit").
    const itemCard = page.locator("div", { hasText: "Widget Test" }).first();
    await expect(itemCard).toContainText("Sellable product");
    await expect(itemCard).toContainText("50 unit");
    await expect(itemCard).toContainText(/COP\s+10,000/);

    // Sale: 2 × 10,000 = 20,000, paid in full on Efectivo.
    await page.goto("/pos/sales");
    await page.getByRole("button", { name: "New Sale" }).click();
    const dialog = page.getByRole("dialog", { name: /Create Sale/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
    await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await dialog.getByLabel(/^Client/).selectOption({ label: "General Client" });
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    // C12-3c: items are added via the search combobox; qty/price ids remain.
    await addSaleItemViaSearch(page, dialog, "Widget Test");
    // The price input renders formatted (thousands separator) when unfocused.
    await expect(dialog.locator("#price-0")).toHaveValue(/^10,000$/);
    await dialog.locator("#qty-0").fill("2");
    await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+20,000/);
    await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
    // Founder rule (2026-09-30): no auto-close — result panel + explicit Close.
    // Wait for the panel before closing: clicking too early races the React
    // swap (form footer → result panel) and the dialog then never closes.
    const panel = dialog.locator("[data-testid='sale-result-panel']");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: /^Close$/ }).click();
    await expect(dialog).toBeHidden();
    // UX-6 task 6.1 (documented NO-OP): POS sale creation has no debit path,
    // so no F5 / confirmation dialog may appear. Negative assertion — a
    // regression that intercepts the submit would fail here (and the
    // follow-up positive assertions below).
    await expectNoSaleConfirmationDialog(page);

    // /pos/sales shows the sale.
    const saleCard = page.locator("div", { hasText: "Widget Test" }).first();
    await expect(saleCard).toContainText("Paid in Full");
    await expect(saleCard).toContainText(/COP\s+20,000/);

    // Income movement recorded on the account (Efectivo 0 → 20,000).
    await expectAccountBalance(page, "Efectivo", "20,000");

    // Stock decremented (POS-3): 50 − 2 = 48 (unit-aware row).
    await page.goto("/pos/catalog");
    await expect(page.locator("div", { hasText: "Widget Test" }).first()).toContainText("48 unit");
  });

  test("POS: on-credit sale creates a linked granted credit and counts the initial payment as income", async ({
    page,
  }) => {
    await freshUser(page);

    await createCatalogItemInUI(page, {
      name: "Servicio Test",
      unitPrice: "10000",
      type: "service",
    });

    await page.goto("/pos/sales");
    await page.getByRole("button", { name: "New Sale" }).click();
    const dialog = page.getByRole("dialog", { name: /Create Sale/i });
    await expect(dialog).toBeVisible();

    // On-credit requires a real client: create one inline from the sale form.
    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "On Credit" });
    await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await dialog.getByRole("button", { name: /Create client/i }).click();
    const clientDialog = page.getByRole("dialog", { name: /New client/i });
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel(/^Name/).fill("Cliente POS");
    // Fase 2 (Ronda Producto 1): the phone is the client's identity field and
    // is required (canonical E.164).
    await clientDialog.getByLabel(/^Phone/).fill("+573001112233");
    await clientDialog.getByRole("button", { name: /^New Client$/ }).click();
    await expect(clientDialog).toBeHidden();

    // Total 10,000, initial payment 4,000 → pending 6,000.
    await dialog.getByLabel(/^Initial payment/).fill("4000");
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    await addSaleItemViaSearch(page, dialog, "Servicio Test");
    await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
    // Founder rule (2026-09-30): result panel with the pending freeze shown;
    // the user closes explicitly before the page-level continuations.
    // Amount assertions are scoped to the whole panel: the summary is a
    // <dl> where "Total:"/"Pending:" <dt> labels live in cells separate
    // from the <dd> values, so label-locators never see the amounts.
    const resultPanel = dialog.locator("[data-testid='sale-result-panel']");
    await expect(resultPanel).toContainText(/COP\s+10,000/);
    await expect(resultPanel).toContainText(/COP\s+6,000/);
    await resultPanel.getByRole("button", { name: /^Close$/ }).click();
    await expect(dialog).toBeHidden();
    // UX-6 task 6.1 (documented NO-OP): the POS on-credit sale creation is
    // also confirmation-free (only the cobro via AbonoForm confirms, not the
    // sale registration). Negative assertion — no F5 / confirmation dialog.
    await expectNoSaleConfirmationDialog(page);

    // /pos/sales: on-credit badge, client, initial payment and pending.
    const saleCard = page.locator("div", { hasText: "Cliente POS" }).first();
    await expect(saleCard).toContainText("On Credit");
    await expect(saleCard).toContainText(/COP\s+10,000/);
    await expect(saleCard).toContainText(/Initial payment:\s*COP\s+4,000/);
    await expect(saleCard).toContainText(/Pending:\s*COP\s+6,000/);

    // A linked granted credit exists with pending = total − initial.
    await page.goto("/credits/granted");
    const creditCard = page.locator("div", { hasText: "Cliente POS" }).first();
    await expect(creditCard).toContainText(/COP\s+10,000/);
    await expect(creditCard).toContainText(/Pending:\s*COP\s+6,000/);

    // The initial payment is income (context-aware, principle #7): Efectivo
    // 0 → 4,000.
    await expectAccountBalance(page, "Efectivo", "4,000");
  });
});
