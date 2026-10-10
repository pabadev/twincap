import { expect, test, type Page } from "@playwright/test";
import { clearRateLimits, registerUser } from "./helpers";

function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

let sequence = 0;
async function freshUser(page: Page): Promise<void> {
  await clearRateLimits();
  const email = `e2e-profit-${Date.now()}-${++sequence}@test.local`;
  await registerUser(page, { email });
}

async function createProduct(
  page: Page,
  { name, price, stock }: { name: string; price: string; stock: string },
): Promise<void> {
  await page.goto("/pos/catalog");
  await page.getByRole("button", { name: /Add product or service/i }).click();
  const dialog = page.getByRole("dialog", { name: /New product or service/i });
  await dialog.getByLabel(/product or service name/i).fill(name);
  await dialog.getByLabel(/^Type$/).selectOption({ label: "Product" });
  await dialog.getByLabel(/^Currency$/).selectOption({ label: "COP" });
  await dialog.getByLabel(/^Unit Price/).fill(price);
  await dialog.getByLabel(/^Sale unit/).selectOption({ label: "unit" });
  await dialog.getByLabel(/^Product use/).selectOption({ label: "Sellable product" });
  await dialog.getByLabel(/^Opening stock/).fill(stock);
  await dialog.getByRole("button", { name: /^Add to catalog$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

async function recordReceipt(page: Page, itemName: string): Promise<void> {
  await page.goto("/pos/catalog/receipts");
  await page
    .getByRole("button", { name: /^Record supply receipt$/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /Record supply receipt/i });
  await dialog.getByLabel(/^Payment account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.locator("#receiptItem-0").selectOption({ label: itemName });
  await dialog.locator("#receiptQuantity-0").fill("10");
  await dialog.locator("#receiptAmount-0").fill("300000");
  await dialog.getByLabel(/^Supplier/).fill("Proveedor E2E rentabilidad");
  await dialog.getByRole("button", { name: /Record receipt/i }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

async function sellProduct(page: Page, itemName: string): Promise<void> {
  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const dialog = page.getByRole("dialog", { name: /Create Sale/i });
  await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
  await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.locator("#item-search").fill(itemName);
  await dialog.getByRole("option", { name: new RegExp(itemName) }).click();
  await expect(dialog.locator("#price-0")).toHaveValue("50,000");
  await dialog.locator("#qty-0").fill("2");
  await expect(dialog.getByText(/Total:/)).toContainText(/COP\s+100,000/);
  const resultPanel = dialog.locator("[data-testid='sale-result-panel']");
  await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
  await expect(resultPanel).toBeVisible({ timeout: 90_000 });
  await resultPanel.getByRole("button", { name: /^Close$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

async function openBusinessSummary(page: Page): Promise<void> {
  const today = todayInputValue();
  await page.goto(`/business-analytics?desde=${today}&hasta=${today}`);
  await expect(page.getByRole("heading", { name: "Your business at a glance" })).toBeVisible();
}

// These walks include several transactional writes (catalog, valuation,
// receipt, sale and adjustment), so they need more time than a single CRUD flow.
test.setTimeout(600_000);
test.use({ actionTimeout: 30_000 });

test.describe.serial("Business profitability acceptance", () => {
  test("E2E-11 — opening value and receipt set sale cost; later cost changes do not rewrite it", async ({
    page,
  }) => {
    await freshUser(page);
    const itemName = "Weighted cost product";
    await createProduct(page, { name: itemName, price: "50000", stock: "10" });

    await page.goto("/pos/catalog");
    const itemCard = page.getByRole("article").filter({ hasText: itemName });
    await itemCard.getByRole("button", { name: /Adjust stock/i }).click();
    const stockDialog = page.getByRole("dialog", { name: /Adjust stock/i });
    await stockDialog.locator('input[name="valueMinor"]').fill("100000");
    await stockDialog.getByRole("button", { name: /Save opening cost/i }).click();
    // Revalidation updates the catalog item and removes the now-complete
    // opening-value form; reopening the dialog loads its persisted history.
    await expect(stockDialog.locator('input[name="valueMinor"]')).toHaveCount(0);
    await stockDialog.getByRole("button", { name: /^Close$/ }).click();
    await expect(stockDialog).toBeHidden();
    await page.goto("/pos/catalog");
    await page
      .getByRole("article")
      .filter({ hasText: itemName })
      .getByRole("button", { name: /Adjust stock/i })
      .click();
    const valuedStockDialog = page.getByRole("dialog", { name: /Adjust stock/i });
    const stockHistory = valuedStockDialog.getByRole("region", { name: /Stock history/i });
    await expect(stockHistory).toContainText(/Opening value/i);
    await expect(stockHistory).toContainText(/100,000/);
    await valuedStockDialog.getByRole("button", { name: /^Close$/ }).click();
    await expect(valuedStockDialog).toBeHidden();

    // 10 units valued at 100,000 plus 10 received at 300,000 gives a 20,000
    // weighted average. The receipt is on credit and must not appear as an expense.
    await recordReceipt(page, itemName);
    await sellProduct(page, itemName);

    await page.goto("/pos/sales");
    const saleCard = page.locator("[data-id]").filter({ hasText: itemName }).first();
    await saleCard.getByRole("button", { name: /^Details$/i }).click();
    const details = page.getByRole("dialog", { name: /Sale detail/i });
    const originalSaleRow = details.getByRole("row").filter({ hasText: itemName });
    await expect(originalSaleRow).toContainText(/40,000/);
    await expect(originalSaleRow).toContainText(/60,000/);
    await page.keyboard.press("Escape");

    // Change the current average with a positive adjustment. The sale snapshot
    // remains 40,000 even after stock valuation changes.
    await page.goto("/pos/catalog");
    const refreshedCard = page.getByRole("article").filter({ hasText: itemName });
    await refreshedCard.getByRole("button", { name: /Adjust stock/i }).click();
    const adjustment = page.getByRole("dialog", { name: /Adjust stock/i });
    await adjustment.getByLabel(/Adjustment type/).selectOption({ label: "Manual stock in" });
    await adjustment.getByLabel(/^Quantity/).fill("2");
    await adjustment.getByLabel(/Total cost of the added stock/).fill("100000");
    await adjustment.getByLabel(/^Reason/).fill("E2E changes current average");
    await adjustment.getByRole("button", { name: /Save adjustment/i }).click();
    await expect(adjustment.getByRole("status")).toContainText(/Stock adjustment saved/i);

    await page.goto("/pos/sales");
    await page
      .locator("[data-id]")
      .filter({ hasText: itemName })
      .first()
      .getByRole("button", { name: /^Details$/i })
      .click();
    const unchangedDetails = page.getByRole("dialog", { name: /Sale detail/i });
    const unchangedSaleRow = unchangedDetails.getByRole("row").filter({ hasText: itemName });
    await expect(unchangedSaleRow).toContainText(/40,000/);
    await expect(unchangedSaleRow).toContainText(/60,000/);

    await openBusinessSummary(page);
    await expect(page.getByText("You sold", { exact: true }).locator("xpath=..")).toContainText(
      /100,000/,
    );
    await expect(
      page.getByText("Recorded cost of products", { exact: true }).locator("xpath=.."),
    ).toContainText(/40,000/);
    await expect(
      page.getByText("Left after product costs", { exact: true }).locator("xpath=.."),
    ).toContainText(/60,000/);
    await expect(
      page.getByText("Expenses you recorded", { exact: true }).locator("xpath=.."),
    ).toContainText(/0|—/);
  });

  test("E2E-12 — unknown product cost stays incomplete and service sales have no inventory cost", async ({
    page,
  }) => {
    await freshUser(page);
    await createProduct(page, { name: "Unknown cost product", price: "100000", stock: "2" });

    await page.goto("/pos/catalog");
    await page.getByRole("button", { name: /Add product or service/i }).click();
    const serviceDialog = page.getByRole("dialog", { name: /New product or service/i });
    await serviceDialog.getByLabel(/product or service name/i).fill("Inventory-free service");
    await serviceDialog.getByLabel(/^Type$/).selectOption({ label: "Service" });
    await serviceDialog.getByLabel(/^Currency$/).selectOption({ label: "COP" });
    await serviceDialog.getByLabel(/^Unit Price/).fill("25000");
    await serviceDialog.getByRole("button", { name: /^Add to catalog$/ }).click();
    await expect(serviceDialog).toBeHidden({ timeout: 90_000 });

    await page.goto("/pos/sales");
    await page.getByRole("button", { name: "New Sale" }).click();
    const clientSaleDialog = page.getByRole("dialog", { name: /Create Sale/i });
    await clientSaleDialog.getByRole("button", { name: /Create client/i }).click();
    const clientDialog = page.getByRole("dialog", { name: /New client/i });
    await clientDialog.getByLabel(/^Name/).fill("Profitability credit client");
    await clientDialog.getByLabel(/^Phone/).fill("+573005551212");
    await clientDialog.getByRole("button", { name: /^New Client$/ }).click();
    await expect(clientDialog).toBeHidden({ timeout: 90_000 });
    await clientSaleDialog.getByRole("button", { name: /^Cancel$/ }).click();

    await page.goto("/pos/sales");
    const creditSale = page.getByRole("button", { name: "New Sale" });
    await creditSale.click();
    const saleDialog = page.getByRole("dialog", { name: /Create Sale/i });
    await saleDialog.getByLabel(/^Payment Mode/).selectOption({ label: "On Credit" });
    await saleDialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await saleDialog.getByLabel(/^Initial payment/).fill("0");
    await saleDialog.getByLabel(/^Client/).selectOption({ label: "Profitability credit client" });
    await saleDialog.getByLabel(/^Date/).fill(todayInputValue());
    await saleDialog.locator("#item-search").fill("Unknown cost product");
    await saleDialog.getByRole("option", { name: /Unknown cost product/ }).click();
    await saleDialog.locator("#qty-0").fill("1");
    await expect(saleDialog.getByText(/Total:/)).toContainText(/COP\s+100,000/);
    const creditResult = saleDialog.locator("[data-testid='sale-result-panel']");
    await saleDialog.getByRole("button", { name: /^Create Sale$/ }).click();
    await expect(creditResult).toBeVisible({ timeout: 90_000 });
    await creditResult.getByRole("button", { name: /^Close$/ }).click();
    await expect(saleDialog).toBeHidden({ timeout: 90_000 });

    await page.goto("/pos/sales");
    const serviceDialogSale = page.getByRole("button", { name: "New Sale" });
    await serviceDialogSale.click();
    const serviceSale = page.getByRole("dialog", { name: /Create Sale/i });
    await serviceSale.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
    await serviceSale.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
    await serviceSale.getByLabel(/^Date/).fill(todayInputValue());
    await serviceSale.locator("#item-search").fill("Inventory-free service");
    await serviceSale.getByRole("option", { name: /Inventory-free service/ }).click();
    await serviceSale.locator("#qty-0").fill("1");
    const serviceResult = serviceSale.locator("[data-testid='sale-result-panel']");
    await serviceSale.getByRole("button", { name: /^Create Sale$/ }).click();
    await expect(serviceResult).toBeVisible({ timeout: 90_000 });
    await serviceResult.getByRole("button", { name: /^Close$/ }).click();
    await expect(serviceSale).toBeHidden({ timeout: 90_000 });

    await page.goto("/pos/sales");
    const serviceCard = page.locator("[data-id]").filter({ hasText: "Inventory-free service" });
    await serviceCard.getByRole("button", { name: /^Details$/i }).click();
    const serviceDetails = page.getByRole("dialog", { name: /Sale detail/i });
    const serviceSaleRow = serviceDetails
      .getByRole("row")
      .filter({ hasText: "Inventory-free service" });
    await expect(serviceSaleRow.getByRole("cell").nth(4)).toContainText(/No inventory cost/);
    await expect(serviceSaleRow.getByRole("cell").last()).toContainText(/25,000/);

    await page.goto("/movements");
    await page.getByRole("button", { name: "Add Movement" }).click();
    const movement = page.getByRole("dialog", { name: /New Movement/i });
    await movement.getByLabel("Context").selectOption({ label: "Business" });
    await movement.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
    await movement.getByLabel("Type").selectOption({ label: "Expense" });
    await movement.getByLabel("Category", { exact: true }).selectOption({ label: "Transporte" });
    await movement.getByLabel("Amount").fill("5000");
    await movement.getByLabel("Note").fill("Business service expense E2E");
    await movement.getByLabel(/^Date/).fill(todayInputValue());
    await movement.getByRole("button", { name: "Add Movement" }).click();
    await expect(movement).toBeHidden({ timeout: 90_000 });

    await openBusinessSummary(page);
    await expect(page.getByText("Sales made", { exact: true }).locator("xpath=..")).toContainText(
      "2",
    );
    await expect(page.getByText("Average sale", { exact: true }).locator("xpath=..")).toContainText(
      /62,500/,
    );
    await expect(
      page.getByText("Recorded cost of products", { exact: true }).locator("xpath=.."),
    ).toContainText(/0|—/);
    await expect(
      page.getByText("Left after product costs", { exact: true }).locator("xpath=.."),
    ).toContainText(/Costs missing/);
    await expect(
      page.getByText("Expenses you recorded", { exact: true }).locator("xpath=.."),
    ).toContainText(/5,000/);
    await expect(
      page.getByText("Left after those expenses", { exact: true }).locator("xpath=.."),
    ).toContainText(/Costs missing/);
    await expect(
      page.getByText("Still to collect from these sales", { exact: true }).locator("xpath=.."),
    ).toContainText(/100,000/);
    await expect(page.getByText(/sales include products without a recorded cost/i)).toBeVisible();
    await expect(page.getByText("Top items by sales amount", { exact: true })).toBeVisible();
  });
});
