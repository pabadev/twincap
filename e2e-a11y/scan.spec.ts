import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { registerUser, seedFinancialData } from "../e2e/helpers";

/**
 * UX-11 — standalone a11y scan (axe-core via @axe-core/playwright).
 * NOT part of the e2e suite, NOT part of CI. Runs explicitly through
 * playwright.a11y.config.ts (isolated testDir, production build, port 3200).
 *
 * Matrix: 5 routes (/dashboard, /movements, /pos/sales, /credits/granted,
 * /help) x 2 viewports (375, 1280) x 2 themes (light, dark) = 20 combos.
 * All contexts are authenticated via the e2e/helpers.ts storageState pattern.
 * Themes are forced through the app's own theme mechanism: the layout's
 * bootstrap script reads localStorage key `twincap-theme` and toggles the
 * `.dark` class on <html>, so the scan pins that key per context.
 *
 * Seeding (task 2.3 guard): one user with real financial data through the UI
 * (registerUser + seedFinancialData shape), one catalog item + one paid-in-
 * full sale (so /pos/sales renders real sale content) and ONE OPEN granted
 * credit (no abono) so /credits/granted renders real content.
 *
 * Output: every axe violation is collected with route/viewport/theme/rule
 * id/impact/selectors and (a) logged to the console and (b) written to
 * openspec/changes/ux-12-polish-final/evidence/a11y-scan-raw.json for the
 * report triage. Nothing under src/ is fixed by this spec — findings are
 * evidence for the UX-11 report (triage P0/P1/other by Part B adjudication).
 */

interface Violation {
  route: string;
  viewport: string;
  theme: string;
  id: string;
  impact: string | null;
  description: string;
  help: string;
  tags: string[];
  nodes: Array<{ target: string[]; html: string }>;
}

const violations: Violation[] = [];
const gaps: string[] = [];

const ROUTES = [
  { path: "/dashboard", content: () => null },
  { path: "/movements", content: () => null },
  { path: "/pos/sales", content: () => null },
  { path: "/credits/granted", content: () => null },
  { path: "/help", content: () => null },
];

const VIEWPORTS: Array<{
  label: string;
  width: number;
  height: number;
  mobile?: boolean;
}> = [
  { label: "375", width: 375, height: 812, mobile: true },
  { label: "1280", width: 1280, height: 800 },
];

const THEMES = ["light", "dark"] as const;

/** Wall-clock today as YYYY-MM-DD (movement/sale form convention). */
function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Create one POS catalog item through the real UI (same shape as e2e). */
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

/** Create ONE paid-in-full sale through the real UI (show-real-content guard). */
async function createPaidSaleInUI(page: Page, itemName: string, price: string): Promise<void> {
  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const dialog = page.getByRole("dialog", { name: /Create Sale/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
  await dialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await dialog.getByLabel(/^Client/).selectOption({ label: "General Client" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  // Line items have no accessible label — driven by CSS id (documented in e2e).
  await dialog.locator("#item-0").selectOption({ label: `${itemName} (Product)` });
  await expect(dialog.locator("#price-0")).toHaveValue(price);
  await dialog.locator("#qty-0").fill("1");
  await dialog.getByRole("button", { name: /^Create Sale$/ }).click();
  await expect(dialog).toBeHidden();
  await expectNoSaleDialog(page);
}

/** UX-6 documented NO-OP: sale creation never opens a confirmation dialog. */
async function expectNoSaleDialog(page: Page): Promise<void> {
  await expect(page.getByRole("dialog", { name: /^Confirm /i })).toHaveCount(0);
}

/** Create ONE OPEN granted credit (2 installments, no abono) through the UI. */
async function createOpenGrantedCreditInUI(page: Page, debtor: string): Promise<void> {
  await page.goto("/credits/granted");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const dialog = page.getByRole("dialog", { name: /New Credit Granted/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Debtor/).fill(debtor);
  await dialog.getByLabel(/^Principal/).fill("100000");
  await dialog.getByLabel(/^Paying Account/).selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel(/^Date/).fill(todayInputValue());
  await dialog.getByLabel(/^Installments/).fill("2");
  await dialog.getByLabel(/^Installment value/).fill("55000");
  await dialog.getByRole("button", { name: /^Add Credit Granted$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("div", { hasText: debtor }).first()).toContainText(
    /Pending:\s*COP\s+110,000/,
  );
}

/** One meaningful-content anchor per route (e2e locale is English). */
async function assertMeaningfulContent(page: Page, route: string): Promise<void> {
  switch (route) {
    case "/dashboard":
      await expect(page.getByText("Income this month").first()).toBeVisible();
      break;
    case "/movements":
      await expect(page.getByRole("button", { name: "Add Movement" })).toBeVisible();
      break;
    case "/pos/sales":
      await expect(page.getByRole("button", { name: "New Sale" })).toBeVisible();
      // The sale card shows the item name + payment mode ("Paid in full").
      // Anchored to the visible card, NOT getByText("Paid in full") — that
      // case-insensitively matched the hidden status-filter <option> and
      // every /pos/sales combo resolved hidden (harness gap, fixed 2026-09-18).
      await expect(page.locator("div", { hasText: "Producto A11y" }).first()).toContainText(
        /Paid in [Ff]ull/,
      );
      break;
    case "/credits/granted":
      await expect(page.getByText("Deudor A11y").first()).toBeVisible();
      break;
    case "/help":
      await expect(page.locator("h1").first()).toBeVisible();
      break;
  }
}

test("UX-11 a11y scan — seed user with real financial content", async ({ page }) => {
  test.setTimeout(300_000);

  const email = await registerUser(page);
  console.log(`[a11y] seeded user: ${email}`);

  // Real financial data (helpers.ts seedFinancialData shape).
  await seedFinancialData(page, {
    monthlyIncome: "1000000",
    monthlyExpense: "300000",
    datedIncome: { amount: "150000", date: todayInputValue() },
    notePrefix: "a11y",
  });

  // POS content: catalog item + one paid-in-full sale.
  const catalogName = `Producto A11y ${Date.now()}`;
  await createCatalogItemInUI(page, {
    name: catalogName,
    unitPrice: "12000",
    stock: "10",
  });
  await createPaidSaleInUI(page, catalogName, "12000");

  // ONE open granted credit for /credits/granted.
  await createOpenGrantedCreditInUI(page, "Deudor A11y");

  // Persist the authenticated session for the scan contexts (file path —
  // Playwright's storageState accepts a path, not inline JSON).
  const storageStatePath = path.join(__dirname, "storage-state.json");
  fs.writeFileSync(storageStatePath, JSON.stringify(await page.context().storageState()));
});

test("UX-11 a11y scan — matrix isolation proof and axe scan of 20 combos", async ({ browser }) => {
  test.setTimeout(300_000);

  const storageState = path.join(__dirname, "storage-state.json");

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        storageState,
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
        deviceScaleFactor: vp.mobile ? 3 : 1,
      });
      // App theme mechanism: the layout bootstrap reads `twincap-theme`
      // from localStorage and toggles the `.dark` class on <html>.
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("twincap-theme", t);
        } catch {
          /* scoped storage unavailable — combo continues with default theme */
        }
      }, theme);
      const page = await context.newPage();

      for (const route of ROUTES) {
        const comboTag = `${route.path}/${vp.label}/${theme}`;
        try {
          await page.goto(route.path, { waitUntil: "domcontentloaded" });
          await assertMeaningfulContent(page, route.path);
          const results = await new AxeBuilder({ page }).analyze();
          for (const v of results.violations) {
            violations.push({
              route: route.path,
              viewport: vp.label,
              theme,
              id: v.id,
              impact: v.impact ?? null,
              description: v.description,
              help: v.help,
              tags: v.tags,
              nodes: v.nodes.slice(0, 5).map((n) => ({
                target: n.target.map(String),
                html: n.html.length > 400 ? `${n.html.slice(0, 400)}…` : n.html,
              })),
            });
          }
          console.log(`[a11y] scanned ${comboTag}: ${results.violations.length} rule(s) violated`);
        } catch (err) {
          // Documented scan gap — NEVER a silent skip (task 2.3).
          const message = err instanceof Error ? err.message : String(err);
          const gap = `A11Y-SCAN-GAP: ${comboTag} rationale: meaningful content did not render — ${message}`;
          gaps.push(gap);
          console.error(gap);
        }
      }
      await context.close();
    }
  }

  // Write the raw artifact for the report triage (task 2.4).
  const outDir = path.join(__dirname, "..", "openspec", "changes", "ux-12-polish-final", "evidence");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "a11y-scan-raw.json"),
    JSON.stringify(
      {
        scannedAt: new Date().toISOString(),
        combos: ROUTES.length * VIEWPORTS.length * THEMES.length,
        totalViolations: violations.length,
        scanGaps: gaps,
        violations,
      },
      null,
      2,
    ),
  );

  const p0p1 = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  console.log(
    `[a11y] DONE: 20 combos, ${violations.length} violation entries, ${p0p1.length} critical/serious, ${gaps.length} scan gap(s)`,
  );
});
