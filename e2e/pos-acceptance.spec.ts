import { expect, test, type Page } from "@playwright/test";
import { clearRateLimits, registerUser, confirmMoneyAction, login } from "./helpers";

/** Duplicate of the per-file helper (helpers.ts keeps it private). */
function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * BETA ACCEPTANCE PACK (mandate pre-beta §19): E2E-01..10.
 *
 * Ten serial tests that walk the POS/inventory lifecycle end to end with a
 * SHARED registered user (serial describe) — the stock ledger is cumulative
 * across tests, and every test asserts ITS OWN delta against the state left
 * by previous ones, which is exactly what proves "no double effects / no
 * lost effects":
 *   01 product → 02 plain sale → 03 granular sale → 04 cash-free receipt →
 *   06 formula sale (consumes components) → 07 combo sale → 05 on-credit
 *   receipt → payable → payment (the financial expense) → 09 stock
 *   adjustment (NO financial movement) → 10 reversals (delete sale restores
 *   stock/money exactly once). 08 client covers client relationships.
 */

let seq = 0;

/**
 * Shared serial credentials. Playwright runs each test in a FRESH browser
 * context (no cookies) — every test after the registration one must log in
 * explicitly to inherit the same workspace (the stock ledger is shared).
 */
let serialCreds: { email: string; password: string } | null = null;

async function freshUser(page: Page): Promise<string> {
  await clearRateLimits();
  const email = `e2e-pos-${Date.now()}-${++seq}@test.local`;
  await registerUser(page, { email });
  serialCreds = { email, password: "Password123!" };
  return email;
}

/** Log in with the serial user (every test after the registration one). */
async function ensureSession(page: Page): Promise<void> {
  if (!serialCreds) throw new Error("serial user not registered yet");
  await clearRateLimits();
  await login(page, { email: serialCreds.email, password: serialCreds.password });
}

const saleDialogSelector = { name: /Create Sale/i };

async function gotoCatalog(page: Page): Promise<void> {
  await page.goto("/pos/catalog");
  await expect(page.getByRole("button", { name: /Add product or service/i })).toBeVisible();
}

/** Supply-role item card (has no sellable badge; stock row is a supply). */
function supplyCard(page: Page, name: string) {
  return page.locator("div", { hasText: name }).filter({ hasText: "Supply" }).first();
}

/**
 * Create a catalog item through /pos/catalog.
 *
 * NOTE on labels (NEXT_LOCALE=en in the E2E environment):
 *  - the type select lists "Product"/"Recipe"/"Combo" (a neutral select —
 *    it MUST be chosen even for plain products, it gates the unit/role/stock
 *    fields);
 *  - the currency select must be chosen BEFORE the price fill (the price
 *    label carries the chosen currency: "Unit Price (COP)");
 *  - unit selects list the lowercase short long-unit names ("kilogram");
 *  - the role select is labelled "Product use".
 */
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
  if (config.type) {
    await dialog.getByLabel(/^Type$/).selectOption({
      label: config.type === "recipe" ? "Recipe" : config.type === "combo" ? "Combo" : "Product",
    });
  }
  await dialog.getByLabel(/^Currency$/).selectOption({ label: "COP" });
  if (config.unitPrice) {
    await dialog.getByLabel(/^Unit Price/).fill(config.unitPrice);
  }
  if (config.saleUnit) {
    await dialog
      .getByLabel(config.type === "recipe" ? /^Sale unit \(recipe yield\)/ : /^Sale unit/)
      .selectOption({ label: config.saleUnit });
  }
  if (config.productRole) {
    await dialog.getByLabel(/^Product use/).selectOption({
      label: config.productRole === "sellable" ? "Sellable product" : "Supply",
    });
  }
  if (config.stock) {
    await dialog.getByLabel(/^Opening stock/).fill(config.stock);
  }
  await dialog.getByRole("button", { name: /^Add to catalog$/ }).click();
  // The create server action (stock ledger + catalog write) can exceed the
  // 15s default under load — observed stuck on "Creating..." at 15s.
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

/**
 * Open the Create Sale dialog. The item is added LATER inside submitSale —
 * Payment Mode/Account must be selected BEFORE the line item re-renders the
 * settings block (the CI-green credits-pos ordering: fields first, item last).
 */
async function openSaleWithItem(page: Page): Promise<ReturnType<Page["locator"]>> {
  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const dialog = page.getByRole("dialog", saleDialogSelector);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Drive the Create Sale dialog to completion and close the result panel. */
async function submitSale(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  item: { search: string; optionName: RegExp },
  qty: string,
  price: string,
  total: RegExp,
  extra?: { initialPayment?: string; paymentMode?: string; client?: string },
): Promise<void> {
  await dialog.getByLabel(/^Payment Mode/).selectOption({
    label: extra?.paymentMode ?? "Paid in Full",
  });
  await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  if (extra?.client) {
    await dialog.getByLabel(/^Client/).selectOption({ label: extra.client });
  }
  if (extra?.initialPayment) {
    await dialog.getByLabel(/^Initial payment/).fill(extra.initialPayment);
  }
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  // C12-3c: the item joins the cart via the search combobox — LAST, after the
  // settings above (line-item render resets uncontrolled selects).
  await dialog.locator("#item-search").fill(item.search);
  await dialog.getByRole("option", { name: item.optionName }).click();
  // Price and qty are per-row; the price input renders formatted when it
  // loses focus (C12-3b) — expect the exact formatted value for qty=1 rows
  // and any qty for fractional cases.
  await expect(dialog.locator("#price-0")).toHaveValue(price, { timeout: 10_000 });
  await dialog.locator("#qty-0").fill(qty);
  await expect(dialog.getByText(/Total:/)).toContainText(total);
  const panel = dialog.locator("[data-testid='sale-result-panel']");
  await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
  // The server action round-trip (stock ledger + movement) can take a while on
  // loaded machines (observed >30s); the 15s default is not enough.
  await expect(panel).toBeVisible({ timeout: 90_000 });
  await panel.getByRole("button", { name: /^Close$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

/** Dashboard "Expenses this month" card assertion. */
async function expectMonthlyExpenses(page: Page, pattern: RegExp): Promise<void> {
  const card = page.getByText("Expenses this month").first().locator("xpath=../..");
  await expect(card).toContainText(pattern);
}

/**
 * Confirm a money action AND wait for its server action response.
 *
 * The UX-6 confirm dialog closes OPTIMISTICALLY (handleConfirm closes the
 * dialog then dispatches the captured FormData), so `confirmMoneyAction` can
 * return while the server action is still in flight — an immediate navigation
 * aborts the POST and the transaction never commits (intermittent loss of the
 * abono/delete). Awaiting the response guarantees the commit.
 */
async function confirmAndAwaitAction(page: Page, pathname: RegExp): Promise<void> {
  const respPromise = page.waitForResponse(
    (r) => {
      try {
        return pathname.test(new URL(r.url()).pathname) && r.request().method() === "POST";
      } catch {
        return false;
      }
    },
    { timeout: 60_000 },
  );
  await confirmMoneyAction(page);
  await respPromise;
}

/**
 * Confirm an EntityDeleteButton flow AND await its server action response.
 *
 * The entity deletes use the ConfirmDialog family (title is the entity
 * confirmTitle, e.g. "Delete this sale?…", confirm button "Delete") — NOT the
 * MoneyActionConfirmation "Confirm …" family that confirmMoneyAction handles
 * (it would NO-OP on these dialogs and the delete would never commit).
 * Unlike the optimistic money-action confirm, this dialog stays open while
 * the awaited action is pending, so hiding it certifies the commit; the
 * response await is belt-and-braces against a slow router refresh.
 */
async function confirmAndAwaitDelete(page: Page, pathname: RegExp): Promise<void> {
  const respPromise = page.waitForResponse(
    (r) => {
      try {
        return pathname.test(new URL(r.url()).pathname) && r.request().method() === "POST";
      } catch {
        return false;
      }
    },
    { timeout: 60_000 },
  );
  const dialog = page.getByRole("dialog", { name: /^Delete this sale\?/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Delete$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await respPromise;
}

/**
 * Open the supply-receipt dialog and select the payment account. The
 * supplier is filled right after the lines complete their amounts (the
 * outstanding-balance state makes the supplier REQUIRED — any no-payment
 * receipt leaves an amount payable).
 */
async function openRecordReceipt(page: Page): Promise<ReturnType<Page["locator"]>> {
  await page.goto("/pos/catalog/receipts");
  await expect(page.getByRole("heading", { name: /Supply receipts/i })).toBeVisible();
  await page
    .getByRole("button", { name: /^Record supply receipt$/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /Record supply receipt/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Payment account/).selectOption({ label: "Efectivo (COP)" });
  return dialog;
}

/**
 * Fill one receipt line (item + qty + amount; the unit select auto-derives
 * from the item's sale unit). Quantity/amount inputs are addressed by id;
 * their aria-labels carry the product name, not the line index.
 */
async function fillReceiptLine(
  dialog: ReturnType<Page["locator"]>,
  index: number,
  item: string,
  quantity: string,
  amount: string,
): Promise<void> {
  await dialog.locator(`#receiptItem-${index}`).selectOption({ label: item });
  await dialog.locator(`#receiptQuantity-${index}`).fill(quantity);
  await dialog.locator(`#receiptAmount-${index}`).fill(amount);
  const supplier = dialog.getByLabel(/^Supplier/);
  if ((await supplier.count()) > 0) {
    await supplier.fill("Molino dorado");
  }
}

// These walks involve several server actions each — up to 5 min per test on
// loaded machines (multiple stock-ledger writes + view assertions).
test.setTimeout(300_000);

test.describe.serial("Beta acceptance pack — E2E-01..10", () => {
  test("E2E-01 — product with unit and stock appears in catalog and POS", async ({ page }) => {
    await freshUser(page);

    await createCatalogItem(page, {
      name: "Café de origen",
      unitPrice: "20000",
      type: "product",
      saleUnit: "kilogram",
      productRole: "sellable",
      stock: "10",
    });

    // Catalog: sellable card with a unit-aware stock row and price.
    await gotoCatalog(page);
    const card = page.locator("div", { hasText: "Café de origen" }).first();
    await expect(card).toContainText("Sellable product");
    await expect(card).toContainText(/10\s+kilogram/);
    await expect(card).toContainText(/COP\s+20,000/);

    // POS: the searcher offers the product.
    await page.goto("/pos/sales");
    await page.getByRole("button", { name: "New Sale" }).click();
    const dialog = page.getByRole("dialog", saleDialogSelector);
    await expect(dialog).toBeVisible();
    await dialog.locator("#item-search").fill("Café");
    await expect(dialog.getByRole("option", { name: /Café de origen/ })).toBeVisible();
    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
  });

  test("E2E-02 — plain sale: stock −2, money +40,000, no double effects", async ({ page }) => {
    await ensureSession(page);
    const dialog = await openSaleWithItem(page);
    await submitSale(
      page,
      dialog,
      { search: "Café de origen", optionName: /Café de origen/ },
      "2",
      "20,000",
      /COP\s+40,000/,
    );

    // /pos/sales registers the sale exactly once ("2 unit" row, 40,000).
    await page.goto("/pos/sales");
    const saleCard = page.locator("div", { hasText: "Café de origen" }).first();
    await expect(saleCard).toContainText("Paid in Full");
    await expect(saleCard).toContainText(/COP\s+40,000/);

    // Stock decremented EXACTLY once.
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /8\s+kilogram/,
    );

    // Money: income movement recorded on Efectivo (0 → 40,000).
    await page.goto("/accounts");
    await expect(page.locator("[data-id]").filter({ hasText: "Efectivo" }).first()).toContainText(
      /COP\s+40,000/,
    );
  });

  test("E2E-03 — granular sale: fractional 0.5 kg converts, persists", async ({ page }) => {
    await ensureSession(page);
    const dialog = await openSaleWithItem(page);
    await submitSale(
      page,
      dialog,
      { search: "Café de origen", optionName: /Café de origen/ },
      "0.5",
      "20,000",
      /COP\s+10,000/,
    );

    // Persisted: stock 8 − 0.5 = 7.5 kg (fractional, unit-aware).
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /7\.5\s+kilogram/,
    );

    await page.goto("/accounts");
    await expect(page.locator("[data-id]").filter({ hasText: "Efectivo" }).first()).toContainText(
      /COP\s+50,000/,
    );
  });

  test("E2E-04 — multi-line cash-free receipt: stock up, ZERO expenses", async ({ page }) => {
    await ensureSession(page);
    await createCatalogItem(page, {
      name: "Harina premium",
      unitPrice: "10000",
      type: "product",
      saleUnit: "unit",
      productRole: "sellable",
      stock: "0",
    });

    // Receipt: physical stock entry with TWO lines and NO initial payment.
    const dialog = await openRecordReceipt(page);
    await fillReceiptLine(dialog, 0, "Café de origen", "5", "30000");
    await dialog.getByRole("button", { name: /Add another supply/i }).click();
    await fillReceiptLine(dialog, 1, "Harina premium", "2", "20000");
    await dialog.getByRole("button", { name: /Record receipt/i }).click();
    // The receipt action writes stock ledger rows + payable/movement — slow on
    // loaded machines; the 15s default expect timeout is not enough.
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // Stock increased on both products.
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /12\.5\s+kilogram/,
    );
    await expect(page.locator("div", { hasText: "Harina premium" }).first()).toContainText(
      /Stock\s*2\s+unit/,
    );

    // CRITICAL (mandate): the receipt itself creates NO financial expense.
    await page.goto("/dashboard");
    await expectMonthlyExpenses(page, /COP\s+0+|^\s*—/);
  });

  test("E2E-06 — formula: recipe sale consumes its components", async ({ page }) => {
    await ensureSession(page);
    // Supplies are the only non-sellable product role — formula inputs.
    // Formula 1 cup: 10 g sugar + 30 ml milk; yield 250 ml; sell ONE cup.
    await createCatalogItem(page, {
      name: "Azúcar refinada",
      type: "product",
      saleUnit: "gram",
      productRole: "supply",
      stock: "1000",
    });
    await createCatalogItem(page, {
      name: "Leche líquida",
      type: "product",
      saleUnit: "milliliter",
      productRole: "supply",
      stock: "2000",
    });

    // Recipe: guided flow — creating a Recipe item opens the formula modal.
    // Yield granularity rule (create-sale.ts:176): component consumption is
    // (component × sold)/(yield) and MUST be an exact count of the component's
    // base atoms — factor-1 units (ml, g... per-unit granularity) require the
    // sold quantity to be a whole multiple of the yield. One Cortado cup is
    // exactly the yield (250 ml), so sell 250 ml. Price is PER SALE UNIT:
    // 60 COP/ml × 250 ml = 15,000 COP per cup (total asserted below).
    await gotoCatalog(page);
    await page.getByRole("button", { name: /^Add product or service$/ }).click();
    const newItem = page.getByRole("dialog", { name: /New product or service/i });
    await expect(newItem).toBeVisible();
    await newItem.getByLabel(/product or service name/i).fill("Cortado del bar");
    await newItem.getByLabel(/^Type$/).selectOption({ label: "Recipe" });
    await newItem.getByLabel(/^Sale unit \(recipe yield\)/).selectOption({ label: "milliliter" });
    await newItem.getByLabel(/^Currency$/).selectOption({ label: "COP" });
    await newItem.getByLabel(/^Unit Price/).fill("60");
    await newItem.getByRole("button", { name: /^Add to catalog$/ }).click();
    await expect(newItem).toBeHidden({ timeout: 90_000 });

    // Guided composition modal ("Prepared product formula") opens next.
    const formula = page.getByRole("dialog", { name: /Prepared product formula/i });
    await expect(formula).toBeVisible();
    // Yield line: ml of yield per preparation.
    await formula.getByLabel(/Yield per preparation/).fill("250");
    // Line 0: 10 g of sugar; add line 1: 30 ml of milk.
    // Option labels: "<name> · <unit>" (en short unit names).
    await formula.locator("#formula-component-0").selectOption({ label: "Azúcar refinada · gram" });
    await formula
      .getByRole("spinbutton", { name: /^Quantity/ })
      .first()
      .fill("10");
    await formula.getByRole("button", { name: /Add another supply/i }).click();
    await formula
      .locator("#formula-component-1")
      .selectOption({ label: "Leche líquida · milliliter" });
    await formula
      .getByRole("spinbutton", { name: /^Quantity/ })
      .nth(1)
      .fill("30");
    await formula.getByRole("button", { name: /Save new version/i }).click();
    await expect(formula).toBeHidden({ timeout: 90_000 });

    // Sell exactly ONE cup (250 ml → whole-multiple yield scale).
    const sale = await openSaleWithItem(page);
    await submitSale(
      page,
      sale,
      { search: "Cortado", optionName: /Cortado del bar/ },
      "250",
      "60",
      /COP\s+15,000/,
    );

    // Component stocks decremented: sugar 990 g, milk 1,970 ml.
    await gotoCatalog(page);
    await expect(supplyCard(page, "Azúcar refinada")).toContainText(/Stock\s*990\s*gram/);
    await expect(supplyCard(page, "Leche líquida")).toContainText(/Stock\s*1,970\s*milliliter/);
  });

  test("E2E-07 — combo: selling a combo consumes its sellable components", async ({ page }) => {
    await ensureSession(page);
    // Combo "Desayuno": 1 × Café + 1 × Harina, price 30,000. The guided combo
    // preset hides Sale unit / Product use / Opening stock (hidden inputs).
    await gotoCatalog(page);
    await page.getByRole("button", { name: /^Add product or service$/ }).click();
    const newItem = page.getByRole("dialog", { name: /New product or service/i });
    await expect(newItem).toBeVisible();
    await newItem.getByLabel(/product or service name/i).fill("Desayuno combo");
    await newItem.getByLabel(/^Type$/).selectOption({ label: "Combo" });
    await newItem.getByLabel(/^Currency$/).selectOption({ label: "COP" });
    await newItem.getByLabel(/^Unit Price/).fill("30000");
    await newItem.getByRole("button", { name: /^Add to catalog$/ }).click();
    await expect(newItem).toBeHidden({ timeout: 90_000 });

    const combo = page.getByRole("dialog", { name: /Combo contents/i });
    await expect(combo).toBeVisible();
    // Qty inputs are bare number fields (label "Quantity") — one per line.
    await combo.locator("#combo-component-0").selectOption({ label: "Café de origen · kilogram" });
    await combo
      .getByRole("spinbutton", { name: /^Quantity/ })
      .first()
      .fill("0.25");
    await combo.getByRole("button", { name: /Add another supply/i }).click();
    await combo.locator("#combo-component-1").selectOption({ label: "Harina premium · unit" });
    await combo
      .getByRole("spinbutton", { name: /^Quantity/ })
      .nth(1)
      .fill("1");
    await combo.getByRole("button", { name: /Save combo contents/i }).click();
    await expect(combo).toBeHidden({ timeout: 90_000 });

    // Sell 1 combo: components consumed (Café −0.25 kg, Harina −1 unit).
    const sale = await openSaleWithItem(page);
    await submitSale(
      page,
      sale,
      { search: "Desayuno", optionName: /Desayuno combo/ },
      "1",
      "30,000",
      /COP\s+30,000/,
    );

    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /12\.25\s+kilogram/,
    );
    await expect(page.locator("div", { hasText: "Harina premium" }).first()).toContainText(
      /Stock\s*1\s+unit/,
    );
  });

  test("E2E-05 — on-credit receipt → payable → payment = the ONLY expense", async ({ page }) => {
    await ensureSession(page);
    // Receipt with NO initial payment → creates an amount payable.
    const dialog = await openRecordReceipt(page);
    await fillReceiptLine(dialog, 0, "Café de origen", "3", "60000");
    await dialog.getByRole("button", { name: /Record receipt/i }).click();
    // The receipt action writes stock ledger rows + payable/movement — slow on
    // loaded machines; the 15s default expect timeout is not enough.
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // Receipt history: balance outstanding.
    await page.goto("/pos/catalog/receipts");
    await expect(page.locator("div", { hasText: /Balance outstanding/ }).first()).toBeVisible();

    // Payables: the 60,000 payable exists (the 50,000 one from E2E-04 also
    // lives here). Scope to THIS payable card: exclude the sibling's 50,000
    // amount so the outer list container (which holds both) never matches.
    // The abono controls live INSIDE the card and are hidden while it is
    // collapsed — expand it first (click the supplier name), credits-pos
    // expandCredit pattern.
    await page.goto("/payables");
    const payableCard = page
      .locator("div", { hasText: /Molino/ })
      .filter({ hasText: /COP\s+60,000/ })
      .filter({ hasNotText: /COP\s+50,000/ })
      .first();
    await expect(payableCard).toBeVisible();
    await payableCard.getByText("Molino dorado", { exact: true }).first().click();
    await payableCard.getByRole("button", { name: /^Add Abono$/ }).click();

    // Pay it in ONE abono.
    await payableCard
      .getByLabel(/^Amount/)
      .first()
      .fill("60000");
    await payableCard
      .getByLabel(/^Account/)
      .first()
      .selectOption({ label: "Efectivo" });
    await payableCard.getByLabel(/^Date/).first().fill(todayInputValue());
    await payableCard.getByRole("button", { name: /^Add Abono$/ }).click();
    await confirmAndAwaitAction(page, /\/payables/);

    // Gasto correspondiente — exactly 60,000, no double accounting.
    await page.goto("/dashboard");
    await expectMonthlyExpenses(page, /COP\s+60,000/);

    // Receipt now Paid in full.
    await page.goto("/pos/catalog/receipts");
    await expect(page.locator("div", { hasText: /Paid in full/ }).first()).toBeVisible();
  });

  test("E2E-09 — stock adjustment: history updates, ZERO financial movement", async ({ page }) => {
    await ensureSession(page);
    // Movement ledger count BEFORE the adjustment — the adjustment must not
    // alter it (measured on /movements itself, then re-asserted after).
    await page.goto("/movements");
    const before = await page.locator("[data-id]").count();

    await gotoCatalog(page);
    // Cards are <article> roots (div hasText matches shared containers —
    // strict-mode violation on the per-card Adjust stock button).
    const card = page.getByRole("article").filter({ hasText: "Café de origen" }).first();

    await card.getByRole("button", { name: /Adjust stock/i }).click();
    const adjust = page.getByRole("dialog", { name: /Adjust stock/i });
    await expect(adjust).toBeVisible();
    await adjust.getByLabel(/Adjustment type/).selectOption({ label: "Manual stock out" });
    await adjust.getByLabel(/^Quantity/).fill("1");
    await adjust.getByLabel(/^Reason/).fill("E2E spill test");
    await adjust.getByRole("button", { name: /Save adjustment/i }).click();
    // The dialog does NOT auto-close: after saving it shows the confirmation
    // status and the refreshed stock history — the history lives HERE (the
    // catalog card shows no adjustment entries), so assert inside the dialog.
    await expect(adjust.getByText(/Stock adjustment saved\./)).toBeVisible();
    await expect(
      adjust.getByRole("region", { name: /Stock history/ }).getByText(/Manual adjustment/),
    ).toBeVisible();
    await adjust.getByRole("button", { name: /^Close$/ }).click();
    await expect(adjust).toBeHidden();

    // Stock decreased (15.25 − 1 = 14.25 kg).
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /14\.25\s+kilogram/,
    );

    // NO financial movement: /movements list row count unchanged.
    await page.goto("/movements");
    await expect(page.locator("[data-id]")).toHaveCount(before);

    // …and the dashboard expenses stay EXACTLY at the E2E-05 total — a stock
    // adjustment must never mint a financial expense (critical mandate §19).
    await page.goto("/dashboard");
    await expectMonthlyExpenses(page, /COP\s+60,000/);
  });

  test("E2E-08 — client: E.164 phone, sale, verifiable activity only", async ({ page }) => {
    await ensureSession(page);
    // Client created inline from the sale form (canonical phone required).
    await page.goto("/pos/sales");
    await page.getByRole("button", { name: "New Sale" }).click();
    const dialog = page.getByRole("dialog", saleDialogSelector);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Create client/i }).click();
    const clientDialog = page.getByRole("dialog", { name: /New client/i });
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel(/^Name/).fill("Cliente E2E A");
    await clientDialog.getByLabel(/^Phone/).fill("+573001111111");
    await clientDialog.getByRole("button", { name: /^New Client$/ }).click();
    await expect(clientDialog).toBeHidden({ timeout: 90_000 });

    // Second client — created standalone, never sells.
    await page.goto("/clients");
    await page
      .getByRole("button", { name: /New client/i })
      .first()
      .click();
    const c2 = page.getByRole("dialog", { name: /New client/i });
    await expect(c2).toBeVisible();
    await c2.getByLabel(/^Name/).fill("Cliente E2E B");
    await c2.getByLabel(/^Phone/).fill("+573002222222");
    await c2.getByRole("button", { name: /^New Client$/ }).click();
    await expect(c2).toBeHidden({ timeout: 90_000 });

    // A sells (paid in full — 20,000, exact total: 1 kg of Café). The client
    // MUST be selected explicitly: creating A inline earlier does NOT carry
    // over (that dialog was abandoned when navigating to /clients for B), and
    // the select defaults to the general client (clientId "").
    const sale = await openSaleWithItem(page);
    await submitSale(
      page,
      sale,
      { search: "Café", optionName: /Café de origen/ },
      "1",
      "20,000",
      /COP\s+20,000/,
      { client: "Cliente E2E A" },
    );

    // Client detail: ONLY real relations are listed (A = 1 sale, B = none).
    // Scope each card by its [data-id] root (MovementCard) — a generic div
    // hasText also matches the list container holding BOTH cards, and .last()
    // then picks whichever link Mongo happened to sort last (order-dependent
    // flake: strict-mode /Sales/ hit the empty-state heading of B).
    await page.goto("/clients");
    await page
      .locator("[data-id]")
      .filter({ hasText: "Cliente E2E A" })
      .getByRole("link", { name: /View client activity/ })
      .click();
    // exact: the empty-state heading "This client has no sales yet." also
    // matches /Sales/i on a client without sales.
    await expect(page.getByRole("heading", { name: "Sales", exact: true })).toBeVisible();
    await expect(page.locator("div", { hasText: /COP\s+20,000/ }).first()).toBeVisible();

    await page.goto("/clients");
    await page
      .locator("[data-id]")
      .filter({ hasText: "Cliente E2E B" })
      .getByRole("link", { name: /View client activity/ })
      .click();
    await expect(page.getByText(/This client has no sales yet/i)).toBeVisible();
  });

  test("E2E-10 — reversals: sale/formula/combo reversals restore every effect exactly once", async ({
    page,
  }) => {
    // Fresh browser context (no cookies) — log in like every other test.
    await ensureSession(page);

    // 1) Delete the E2E-03 sale (COP 10,000 granular): restore 0.5 kg + income.
    await page.goto("/pos/sales");
    // Sale cards are MovementCard roots ([data-id]) — a generic div hasText
    // matches the list CONTAINER holding several cards (strict-mode: 5
    // Delete buttons resolved), so scope to the card root like the clients
    // list in E2E-08.
    const saleCard = page
      .locator("[data-id]")
      .filter({ hasText: "Café de origen" })
      .filter({ hasText: /COP\s+10,000/ });
    await expect(saleCard).toBeVisible();
    await saleCard.getByRole("button", { name: /^Delete$/ }).click();
    // UX-6 informed-confirmation on destructive money actions (ConfirmDialog
    // family — see confirmAndAwaitDelete).
    // Await the server action: the delete commits inside handleConfirm.
    await confirmAndAwaitDelete(page, /\/pos\/sales/);

    // Stock restored EXACTLY once (+0.5 kg): 14.25 after E2E-09, −1 from the
    // E2E-08 client sale, +0.5 of the deleted granular sale = 13.75.
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /13\.75\s+kilogram/,
    );

    // 2) Delete the E2E-07 combo sale (30,000): restore its components.
    await page.goto("/pos/sales");
    const comboCard = page
      .locator("[data-id]")
      .filter({ hasText: "Desayuno combo" })
      .filter({ hasText: /COP\s+30,000/ });
    await expect(comboCard).toBeVisible();
    await comboCard.getByRole("button", { name: /^Delete$/ }).click();
    await confirmAndAwaitDelete(page, /\/pos\/sales/);
    // Café +0.25 kg (13.75 → 14) and Harina +1 unit (1 → 2).
    await gotoCatalog(page);
    await expect(page.locator("div", { hasText: "Café de origen" }).first()).toContainText(
      /Stock\s*14\s+kilogram/,
    );
    await expect(page.locator("div", { hasText: "Harina premium" }).first()).toContainText(
      /Stock\s*2\s+unit/,
    );

    // 3) Delete the E2E-06 formula sale (15,000): restore its supplies.
    await page.goto("/pos/sales");
    const recipeCard = page
      .locator("[data-id]")
      .filter({ hasText: "Cortado del bar" })
      .filter({ hasText: /COP\s+15,000/ });
    await expect(recipeCard).toBeVisible();
    await recipeCard.getByRole("button", { name: /^Delete$/ }).click();
    await confirmAndAwaitDelete(page, /\/pos\/sales/);
    // Sugar 990 → 1,000 g and milk 1,970 → 2,000 ml, exactly once.
    await gotoCatalog(page);
    await expect(supplyCard(page, "Azúcar refinada")).toContainText(/Stock\s*1,000\s*gram/);
    await expect(supplyCard(page, "Leche líquida")).toContainText(/Stock\s*2,000\s*milliliter/);

    // 4) The deleted sales are gone from the list (no doubling anywhere).
    await page.goto("/pos/sales");
    for (const gone of [
      { name: "Café de origen", amount: /COP\s+10,000/ },
      { name: "Desayuno combo", amount: /COP\s+30,000/ },
      { name: "Cortado del bar", amount: /COP\s+15,000/ },
    ]) {
      await expect(
        page.locator("[data-id]").filter({ hasText: gone.name }).filter({ hasText: gone.amount }),
      ).toHaveCount(0);
    }
  });
});
