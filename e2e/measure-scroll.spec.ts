import { test, expect, Page } from "@playwright/test";
import { registerUser, confirmMoneyAction, confirmDialog } from "./helpers";

/**
 * Throwaway measurement spec: reproduces the "blank space below the content"
 * report on /dashboard. Seeds a rich dataset (credits granted/received,
 * payables, multi-currency accounts + transfer, POS sale) and measures
 * scroll metrics + oversized elements.
 *
 * Run: node e2e/load-e2e-env.cjs test e2e/measure-scroll.spec.ts
 *        --reporter=line --retries=0
 */

function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

async function createAccountInUI(
  page: Page,
  name: string,
  initialBalance: string,
  currency?: string,
): Promise<void> {
  await page.goto("/accounts");
  await page.getByRole("button", { name: /Add Account/i }).click();
  const dialog = page.getByRole("dialog", { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Account Name").fill(name);
  if (currency) {
    await dialog.getByLabel("Currency").selectOption({ label: currency });
  }
  await dialog.getByLabel("Initial Balance").fill(initialBalance);
  await dialog.getByRole("button", { name: /Create Account/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function createMovementInUI(
  page: Page,
  {
    type,
    amount,
    note,
    accountLabel,
  }: {
    type: "income" | "expense";
    amount: string;
    note: string;
    accountLabel?: string;
  },
): Promise<void> {
  await page.goto("/movements");
  await page.getByRole("button", { name: "Add Movement" }).click();
  const dialog = page.getByRole("dialog", { name: /New Movement/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Type/i).selectOption(type);
  await dialog.getByLabel(/Amount/i).fill(amount);
  if (accountLabel) {
    await dialog.getByLabel(/^Account/i).selectOption({ label: accountLabel });
  } else {
    await dialog.getByLabel(/^Account/i).selectOption({ index: 1 });
  }
  const categorySelect = dialog.getByLabel("Category", { exact: true });
  await categorySelect.selectOption({ index: 1 });
  await dialog.getByLabel(/Note|Description/i).fill(note);
  await dialog.getByRole("button", { name: /Add movement/i }).click();
  await confirmMoneyAction(page);
  await expect(dialog).toBeHidden();
}

async function createGrantedCreditInUI(
  page: Page,
  { debtor, principal }: { debtor: string; principal: string },
): Promise<void> {
  await page.goto("/credits/granted");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const dialog = page.getByRole("dialog", { name: /New Credit Granted/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Debtor/).fill(debtor);
  await dialog.getByLabel(/^Principal/).fill(principal);
  await dialog.getByLabel(/^Paying Account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.getByRole("button", { name: /^Add Credit Granted$/ }).click();
  await expect(dialog).toBeHidden();
}

async function createReceivedCreditInUI(
  page: Page,
  { counterparty, principal }: { counterparty: string; principal: string },
): Promise<void> {
  await page.goto("/credits/received");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const dialog = page.getByRole("dialog", { name: /New Credit Received/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Counterparty/).fill(counterparty);
  await dialog.getByLabel(/^Principal/).fill(principal);
  await dialog.getByLabel(/^Receiving Account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.getByRole("button", { name: /^Add Credit Received$/ }).click();
  await expect(dialog).toBeHidden();
}

async function createPayableInUI(
  page: Page,
  { vendor, total, initialPayment }: { vendor: string; total: string; initialPayment: string },
): Promise<void> {
  await page.goto("/payables");
  await page.getByRole("button", { name: "Add Payable" }).click();
  const dialog = page.getByRole("dialog", { name: /New Payable/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Counterparty (Vendor)").fill(vendor);
  await dialog.getByLabel("Total (COP)").fill(total);
  await dialog.getByLabel("Paying Account").selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel("Initial Payment (COP)").fill(initialPayment);
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.getByRole("button", { name: "Add Payable" }).click();
  await expect(dialog).toBeHidden();
}

async function createTransferInUI(
  page: Page,
  {
    from,
    to,
    sourceAmount,
    destAmount,
  }: { from: string; to: string; sourceAmount: string; destAmount: string },
): Promise<void> {
  await page.goto("/transfers");
  await page.getByRole("button", { name: "Add Transfer" }).click();
  const dialog = page.getByRole("dialog", { name: /New Transfer/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("From Account").selectOption({ label: from });
  await dialog.getByLabel("To Account").selectOption({ label: to });
  await dialog.getByLabel(/Source Amount/).fill(sourceAmount);
  await dialog.getByLabel(/Dest Amount/).fill(destAmount);
  await dialog.getByRole("button", { name: "Add Transfer" }).click();
  // May trigger F5 negative-balance confirmation if source has insufficient funds
  const insufficient = page.getByRole("dialog", {
    name: /Insufficient funds in the source account/i,
  });
  try {
    await insufficient.waitFor({ state: "visible", timeout: 2000 });
    await insufficient.getByRole("button", { name: "Register anyway" }).click();
  } catch {
    // no confirmation needed
  }
  await expect(page.getByRole("dialog", { name: /New Transfer/i })).toBeHidden();
}

async function createCatalogItemInUI(
  page: Page,
  { name, unitPrice, stock }: { name: string; unitPrice: string; stock: string },
): Promise<void> {
  await page.goto("/pos/catalog");
  await page.getByRole("button", { name: "Add Item" }).click();
  const dialog = page.getByRole("dialog", { name: /New Catalog Item/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Unit Price/).fill(unitPrice);
  await dialog.getByLabel(/^Stock/).fill(stock);
  await dialog.getByRole("button", { name: /^Add Item$/ }).click();
  await expect(dialog).toBeHidden();
}

async function createPosSaleInUI(
  page: Page,
  { itemLabel, qty }: { itemLabel: string; qty: string },
): Promise<void> {
  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const dialog = page.getByRole("dialog", { name: /Create Sale/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
  await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await dialog.getByLabel(/^Client/).selectOption({ label: "General Client" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.locator("#item-0").selectOption({ label: itemLabel });
  await dialog.locator("#qty-0").fill(qty);
  await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
  await expect(dialog).toBeHidden();
}

test.setTimeout(300_000);

test("measure dashboard scroll metrics with rich data", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 720 });
  await registerUser(page, {});

  // 1. Base account (COP) + movements
  await createAccountInUI(page, "Banco", "1200000");
  await createMovementInUI(page, { type: "income", amount: "350000", note: "Salario" });
  await createMovementInUI(page, { type: "expense", amount: "42000", note: "Mercado" });
  await createMovementInUI(page, { type: "expense", amount: "180000", note: "Arriendo" });
  await createMovementInUI(page, { type: "income", amount: "80000", note: "Freelance" });

  // 2. Credit granted (receivable)
  await createGrantedCreditInUI(page, { debtor: "Juan Perez", principal: "500000" });

  // 3. Credit received (payable-like)
  await createReceivedCreditInUI(page, { counterparty: "Banco Acme", principal: "800000" });

  // 4. Payable
  await createPayableInUI(page, {
    vendor: "Proveedor Alfa",
    total: "300000",
    initialPayment: "50000",
  });

  // 5. Multi-currency: USD account + cross-currency transfer
  await createAccountInUI(page, "Dollar Account", "0", "USD");
  await createTransferInUI(page, {
    from: "Efectivo (COP)",
    to: "Dollar Account (USD)",
    sourceAmount: "190000",
    destAmount: "5000",
  });

  // 6. POS sale (paid in full)
  await createCatalogItemInUI(page, {
    name: "Widget Test",
    unitPrice: "25000",
    stock: "100",
  });
  await createPosSaleInUI(page, { itemLabel: "Widget Test (Product)", qty: "3" });

  // --- Measurement ---
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);

  const dash = await page.evaluate(() => {
    const main = document.querySelector("main");
    const root = document.querySelector("div.space-y-8") as HTMLElement | null;
    const lastChild = root ? (root.lastElementChild as HTMLElement | null) : null;

    // Capture oversized elements (height > 400) that could cause blank space
    const oversized: Array<{
      tag: string;
      classes: string;
      h: number;
      top: number;
      bottom: number;
    }> = [];
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 400) {
        const cls =
          typeof el.className === "string" ? el.className.split(" ").slice(0, 3).join(" ") : "";
        oversized.push({
          tag: el.tagName,
          classes: cls,
          h: Math.round(rect.height),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        });
      }
    }
    oversized.sort((a, b) => b.h - a.h);

    // Lowest 10 elements by bottom position
    const lowest = all
      .map((el) => ({
        tag:
          el.tagName +
          (el.className && typeof el.className === "string"
            ? "." + el.className.split(" ").slice(0, 2).join(".")
            : ""),
        bottom: Math.round(el.getBoundingClientRect().bottom),
        h: Math.round(el.getBoundingClientRect().height),
      }))
      .sort((a, b) => b.bottom - a.bottom)
      .slice(0, 10);

    return {
      doc: document.documentElement.scrollHeight,
      body: document.body.scrollHeight,
      vh: window.innerHeight,
      mainScroll: main?.scrollHeight,
      mainH: main?.getBoundingClientRect().height,
      mainOverflowY: main ? getComputedStyle(main).overflowY : "-",
      rootRect: root
        ? {
            h: Math.round(root.getBoundingClientRect().height),
            top: Math.round(root.getBoundingClientRect().top),
            bottom: Math.round(root.getBoundingClientRect().bottom),
          }
        : null,
      lastChild: lastChild
        ? {
            tag: lastChild.tagName,
            classes:
              typeof lastChild.className === "string"
                ? lastChild.className.split(" ").slice(0, 3).join(" ")
                : "",
            h: Math.round(lastChild.getBoundingClientRect().height),
            top: Math.round(lastChild.getBoundingClientRect().top),
            bottom: Math.round(lastChild.getBoundingClientRect().bottom),
          }
        : null,
      lowest,
      oversized: oversized.slice(0, 15),
    };
  });
  console.log("DASH:", JSON.stringify(dash, null, 1));

  // Also dump visible section headings to confirm what rendered
  const sections = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
    return headings.map((h) => ({
      tag: h.tagName,
      text: (h.textContent ?? "").trim().slice(0, 80),
    }));
  });
  console.log("SECTIONS:", JSON.stringify(sections, null, 1));
});
