import { expect, test, type Page } from "@playwright/test";
import { clearRateLimits, registerUser, confirmMoneyAction, login } from "./helpers";

/**
 * PRE-BETA ROUND: rejection paths + founder-observed regressions (P3–P6 of
 * the approved coverage plan).
 *
 * The acceptance pack (pos-acceptance) walks the happy paths; these serial
 * tests cover the situations a REAL user hits first:
 *   P3 — selling more stock than exists: rejected with a clear toast, stock
 *        and money untouched (no phantom income);
 *   P4 — an abono larger than the payable's pending: rejected (PAY-R-2),
 *        pending unchanged;
 *   P5 — "Volver a facturar" from the POS result panel: the re-invoiced sale
 *        registers EXACTLY once (a fresh idempotency key, no double effects);
 *   P6 — the success toast of Set Initial Balance fires EXACTLY ONCE (the
 *        infinite-toast regression the founder hit is now guarded).
 */

let seq = 0;

let serialCreds: { email: string; password: string } | null = null;

async function freshUser(page: Page): Promise<string> {
  await clearRateLimits();
  const email = `e2e-rej-${Date.now()}-${++seq}@test.local`;
  await registerUser(page, { email });
  serialCreds = { email, password: "Password123!" };
  return email;
}

async function ensureSession(page: Page): Promise<void> {
  if (!serialCreds) throw new Error("serial user not registered yet");
  await clearRateLimits();
  await login(page, { email: serialCreds.email, password: serialCreds.password });
}

function todayInputValue(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const saleDialogSelector = { name: /Create Sale/i };

async function gotoCatalog(page: Page): Promise<void> {
  await page.goto("/pos/catalog");
  await expect(page.getByRole("button", { name: /Add product or service/i })).toBeVisible();
}

async function createCatalogItem(
  page: Page,
  config: {
    name: string;
    unitPrice?: string;
    type: "product" | "recipe" | "combo";
    saleUnit?: string;
    productRole?: "sellable" | "supply";
    stock?: string;
  },
): Promise<void> {
  await gotoCatalog(page);
  await page.getByRole("button", { name: /Add product or service/i }).click();
  const dialog = page.getByRole("dialog", { name: /New product or service/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/product or service name/i).fill(config.name);
  await dialog.getByLabel(/^Type$/).selectOption({
    label: config.type === "recipe" ? "Recipe" : config.type === "combo" ? "Combo" : "Product",
  });
  await dialog.getByLabel(/^Currency$/).selectOption({ label: "COP" });
  if (config.unitPrice) {
    await dialog.getByLabel(/^Unit Price/).fill(config.unitPrice);
  }
  if (config.saleUnit) {
    await dialog.getByLabel(/^Sale unit/).selectOption({ label: config.saleUnit });
  }
  if (config.productRole) {
    await dialog
      .getByLabel(/^Product use/)
      .selectOption({ label: config.productRole === "sellable" ? "Sellable product" : "Supply" });
  }
  if (config.stock) {
    await dialog.getByLabel(/^Opening stock/).fill(config.stock);
  }
  await dialog.getByRole("button", { name: /^Add to catalog$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

async function openSaleWithItem(page: Page): Promise<ReturnType<Page["locator"]>> {
  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const dialog = page.getByRole("dialog", saleDialogSelector);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function submitSale(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  item: { search: string; optionName: RegExp },
  qty: string,
  price: string,
  total: RegExp,
): Promise<void> {
  await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
  await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.locator("#item-search").fill(item.search);
  await dialog.getByRole("option", { name: item.optionName }).click();
  await expect(dialog.locator("#price-0")).toHaveValue(price, { timeout: 10_000 });
  await dialog.locator("#qty-0").fill(qty);
  await expect(dialog.getByText(/Total:/)).toContainText(total);
  const panel = dialog.locator("[data-testid='sale-result-panel']");
  await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
  await expect(panel).toBeVisible({ timeout: 90_000 });
  return;
}

/** The toast live region (single aria-live=polite container per page). */
function toasts(page: Page) {
  return page.locator("[aria-live='polite'] > div");
}

/**
 * Efectivo COP balance, numeric (the serial workspace is CUMULATIVE —
 * assertions must own a DELTA, not absolute values).
 */
async function readEfectivoBalance(page: Page): Promise<number> {
  await page.goto("/accounts");
  const text = await page.locator("[data-id]").filter({ hasText: "Efectivo" }).first().innerText();
  const match = text.match(/COP\s+((?:\d{1,3}(?:,\d{3})+|\d+))/);
  if (!match) throw new Error(`Efectivo amount not found in: ${text}`);
  return Number(match[1].replace(/,/g, ""));
}

test.setTimeout(300_000);

test.describe.serial("Pre-beta regression paths — P3..P6", () => {
  test("P3 — oversell is rejected: clear toast, stock and money untouched", async ({ page }) => {
    await freshUser(page);

    await createCatalogItem(page, {
      name: "Yerba limitada",
      unitPrice: "7000",
      type: "product",
      saleUnit: "unit",
      productRole: "sellable",
      stock: "3",
    });

    const dialog = await openSaleWithItem(page);
    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
    await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    await dialog.locator("#item-search").fill("Yerba limitada");
    await dialog.getByRole("option", { name: /Yerba limitada/ }).click();
    await expect(dialog.locator("#price-0")).toHaveValue("7,000", { timeout: 10_000 });
    await dialog.locator("#qty-0").fill("8");
    await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+56,000/);
    await dialog.getByRole("button", { name: /^Create Sale$/ }).click();

    // The server rejects (POS-3 oversell guard) and SURFACES it: error toast,
    // form stays open with the data, NO result panel appears.
    await expect(
      page.locator("[aria-live='polite']").getByText("There is not enough stock to complete"),
    ).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-testid='sale-result-panel']")).toHaveCount(0);

    // Zero side effects: stock unchanged AND Efectivo at 0 (no minted income).
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Yerba limitada" }).first()).toContainText(
      /Stock\s*3\s*unit/,
    );
    await page.goto("/accounts");
    await expect(page.locator("[data-id]").filter({ hasText: "Efectivo" }).first()).toContainText(
      /COP\s+0/,
    );

    // Cleanup for the serial flow: the failed dialog is gone with the page.
  });

  test("P4 — abono exceeding pending is rejected, pending unchanged", async ({ page }) => {
    await ensureSession(page);

    // Payable total 10,000 with NO initial payment → pending 10,000.
    await page.goto("/payables");
    await page.getByRole("button", { name: "Add Payable" }).click();
    const payableDialog = page.getByRole("dialog", { name: /New Payable/i });
    await expect(payableDialog).toBeVisible();
    await payableDialog.getByLabel("Counterparty (Vendor)").fill("Proveedor Beta");
    await payableDialog.getByLabel("Paying Account").selectOption({ label: "Efectivo (COP)" });
    await payableDialog.getByLabel("Total (COP)").fill("10000");
    await payableDialog.getByLabel("Initial Payment (COP)").fill("0");
    await payableDialog.getByLabel(/^Date/).fill(todayInputValue());
    await payableDialog.getByRole("button", { name: "Add Payable" }).click();
    await expect(payableDialog).toBeHidden({ timeout: 90_000 });

    // Plenty of cash so ONLY the overpay rule rejects (never the F5 flow).
    await page.goto("/movements");
    await page.getByRole("button", { name: "Add Movement" }).click();
    const movementDialog = page.getByRole("dialog", { name: /New Movement/i });
    await expect(movementDialog).toBeVisible();
    await movementDialog.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
    await movementDialog.getByLabel("Type").selectOption({ label: "Income" });
    await movementDialog.getByLabel("Category", { exact: true }).selectOption({ label: "Salario" });
    await movementDialog.getByLabel("Amount").fill("200000");
    await movementDialog.getByLabel("Note").fill("P4 cash");
    await movementDialog.getByRole("button", { name: "Add Movement" }).click();
    await expect(movementDialog).toBeHidden({ timeout: 90_000 });

    // Attempt an abono of 99,999 against a pending of 10,000 — PAY-R-2.
    await page.goto("/payables");
    const payableCard = page.locator("div[id^='payable-']", { hasText: "Proveedor Beta" });
    await expect(payableCard).toBeVisible();
    await payableCard.getByText("Proveedor Beta", { exact: true }).first().click();
    await payableCard.getByRole("button", { name: /^Add Abono$/ }).click();
    // CONTRACT: the
    // form constrains the amount client-side (Input max = pending — PAY-R-2
    // surfaced in the field itself): the NATIVE constraint blocks the submit
    // BEFORE the informed-confirmation dialog — the intercept never runs and
    // the POST never fires (trace-verified: no dialog, no POST, form intact).
    const amountInput = payableCard.getByLabel(/^Amount/).first();
    await amountInput.fill("99999");
    await expect(amountInput).toHaveAttribute("max", "10000");
    await payableCard.getByRole("button", { name: /^Add Abono$/ }).click();

    // Blocked: NO confirmation dialog opens, NOTHING registers — the payable
    // keeps EXACTLY its original pending.
    await expect(page.getByRole("dialog", { name: /^Confirm /i })).toHaveCount(0);
    await page.goto("/payables");
    await expect(page.locator("div[id^='payable-']", { hasText: "Proveedor Beta" })).toContainText(
      /Pending:\s*COP\s+10,000/,
    );
  });

  test("P5 — Volver a facturar registers the re-invoiced sale exactly once", async ({ page }) => {
    await ensureSession(page);

    // P5's re-bill must add EXACTLY +6,000 (two sales × 3,000) over whatever
    // balance the serial flow left — deltas, not absolutes (the workspace is
    // cumulative).
    const balanceBefore = await readEfectivoBalance(page);

    await createCatalogItem(page, {
      name: "Manzana roja",
      unitPrice: "3000",
      type: "product",
      saleUnit: "unit",
      productRole: "sellable",
      stock: "10",
    });

    // Sale 1 through the dialog.
    const dialog = await openSaleWithItem(page);
    await submitSale(
      page,
      dialog,
      { search: "Manzana", optionName: /Manzana roja/ },
      "1",
      "3,000",
      /COP\s+3,000/,
    );
    const panel = dialog.locator("[data-testid='sale-result-panel']");
    await expect(panel).toBeVisible({ timeout: 90_000 });

    // Re-bill from the panel WITHOUT closing the dialog (founder flow A-#2).
    await panel.getByRole("button", { name: /Volver a facturar/ }).click();
    // The form is back (clean slate inside the SAME dialog).
    await expect(dialog.getByLabel(/^Payment Mode/)).toBeVisible();

    // Sale 2, identical item — new idempotency key, exactly one more sale.
    await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
    await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await dialog.getByLabel(/^Date/).fill(todayInputValue());
    await dialog.locator("#item-search").fill("Manzana");
    await dialog.getByRole("option", { name: /Manzana roja/ }).click();
    await expect(dialog.locator("#price-0")).toHaveValue("3,000", { timeout: 10_000 });
    await dialog.locator("#qty-0").fill("1");
    await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+3,000/);
    await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
    await expect(dialog.locator("[data-testid='sale-result-panel']")).toHaveCount(1, {
      timeout: 90_000,
    });
    await dialog
      .locator("[data-testid='sale-result-panel']")
      .getByRole("button", { name: /^Close$/ })
      .click();
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // EXACTLY two sales of the item (no doubling), stock −2, money +6,000.
    await page.goto("/pos/sales");
    await expect(page.locator("[data-id]", { hasText: "Manzana roja" })).toHaveCount(2);
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Manzana roja" }).first()).toContainText(
      /Stock\s*8\s*unit/,
    );
    await page.goto("/accounts");
    const balanceAfter = await readEfectivoBalance(page);
    expect(balanceAfter).toBe(balanceBefore + 6000);
  });

  test("P6 — Set Initial Balance success toast fires exactly once", async ({ page }) => {
    await ensureSession(page);

    await page.goto("/accounts");
    await page.getByRole("button", { name: /Add Account/i }).click();
    const accountDialog = page.getByRole("dialog", { name: /Add Account/i });
    await expect(accountDialog).toBeVisible();
    await accountDialog.getByLabel("Account Name").fill("Toast Pulse");
    await accountDialog.getByLabel("Currency").selectOption({ label: "COP" });
    await accountDialog.getByRole("button", { name: /Create Account/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Toast Pulse", { exact: true }).first()).toBeVisible();

    const row = page.locator("[data-id]", { hasText: "Toast Pulse" });
    await row.getByRole("button", { name: /Set Initial Balance/i }).click();
    const balanceDialog = page.getByRole("dialog", { name: /Set Initial Balance/i });
    await expect(balanceDialog).toBeVisible();
    await balanceDialog.getByLabel("Balance to set").fill("5000");
    await balanceDialog.getByRole("button", { name: "Set Initial Balance" }).click();
    await confirmMoneyAction(page);
    await expect(balanceDialog).toBeHidden();

    // EXACTLY ONE success toast — and STAYS one (the infinite-toast regression
    // stacked a toast per re-fired effect; the UX-6 dispatch rework must keep
    // the delivery AND the guard).
    await expect(
      page.locator("[aria-live='polite']").getByText(/Initial balance set/i),
    ).toHaveCount(1);
    await page.waitForTimeout(1500);
    await expect(
      page.locator("[aria-live='polite']").getByText(/Initial balance set/i),
    ).toHaveCount(1);

    // The balance landed (the mutation the toast reports actually committed).
    await expect(page.locator("[data-id]", { hasText: "Toast Pulse" })).toContainText("5,000");
  });
});
