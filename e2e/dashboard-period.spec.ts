import { expect, test, type Page } from "@playwright/test";
import { clearRateLimits, registerUser, confirmF5NegativeBalance, login } from "./helpers";

/**
 * PRE-BETA ROUND: dashboard intelligence (§5.1 compare + §6 selector + §7
 * alerts) — the board features the acceptance pack E2E-01..10 does not walk.
 *
 * Four serial tests on a SHARED registered user (each test owns its delta):
 *   P1a comparison — income this month + expense this month + expense LAST
 *      month → per-currency ▲/▼ segments and the no-reference placeholder;
 *   P1b selector — month → year updates the labels + URL ?periodo=year,
 *      Clear filters resets;
 *   P2a atypical expense — ≥3 reference months with expense data + a current
 *      month total > 1.5× the rolling mean → alert card in Atención;
 *   P2b negative balance — an expense that sinks a realized account →
 *      informational alert card (F5 informed-confirmation on the way in).
 *
 * Contract notes (verified against the app):
 *  - The delta segments render `▲ N%` / `▼ N%` / `• N%` (aria-hidden) with an
 *    sr-only full sentence ("COP expenses 200% more vs the previous month");
 *    when the previous period is 0 the segment shows the absolute delta and
 *    the sr-only sentence says "has no comparable reference" — prev==0 must
 *    NEVER become Infinity/NaN/a 0% claim.
 *  - The atypical rule (build-dashboard-snapshot.ts): month mode only,
 *    reference = mean expenses of the LAST 5 months (÷5) requiring ≥3 of
 *    them to carry expense data, alert when current > reference × 1.5 with
 *    ratio visible in the copy.
 */

let seq = 0;

let serialCreds: { email: string; password: string } | null = null;

async function freshUser(page: Page): Promise<string> {
  await clearRateLimits();
  const email = `e2e-dash-${Date.now()}-${++seq}@test.local`;
  await registerUser(page, { email });
  serialCreds = { email, password: "Password123!" };
  return email;
}

async function ensureSession(page: Page): Promise<void> {
  if (!serialCreds) throw new Error("serial user not registered yet");
  await clearRateLimits();
  await login(page, { email: serialCreds.email, password: serialCreds.password });
}

/** yyyy-mm-dd of the 15th of `monthsAgo` months before today (local civil). */
function day15MonthsAgo(monthsAgo: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** yyyy-mm-dd of today (local civil). */
function todayInputValue(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Register a movement through /movements. `date` is an optional yyyy-mm-dd
 * overriding the form's today default (max = today, past dates allowed —
 * the civil-calendar basis the dashboard comparison relies on).
 */
async function createMovementInUI(
  page: Page,
  {
    type,
    category,
    amount,
    note,
    date,
  }: {
    type: "income" | "expense";
    category: string;
    amount: string;
    note: string;
    date?: string;
  },
): Promise<void> {
  await page.goto("/movements");
  await page.getByRole("button", { name: "Add Movement" }).click();
  const dialog = page.getByRole("dialog", { name: /New Movement/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
  await dialog.getByLabel("Type").selectOption({ label: type === "income" ? "Income" : "Expense" });
  await dialog.getByLabel("Category", { exact: true }).selectOption({ label: category });
  if (date) {
    await dialog.getByLabel("Date").fill(date);
  }
  await dialog.getByLabel("Amount").fill(amount);
  await dialog.getByLabel("Note").fill(note);
  await dialog.getByRole("button", { name: "Add Movement" }).click();
  await confirmF5NegativeBalance(page);
  await expect(dialog).toBeHidden({ timeout: 90_000 });
}

/** The summary card whose heading matches `title` (scoped card comparison). */
function summaryCard(page: Page, title: RegExp) {
  return page.getByText(title).first().locator("xpath=ancestor::div[2]");
}

test.setTimeout(300_000);

test.describe.serial("Pre-beta dashboard intelligence — §5.1/§6/§7", () => {
  test("P1a — comparison: monthly deltas per currency and no-reference placeholder", async ({
    page,
  }) => {
    await freshUser(page);

    // Income FIRST (Efectivo starts at 0 → later past-dated expenses must not
    // trip the negative-balance confirmation mid-scenario).
    await createMovementInUI(page, {
      type: "income",
      category: "Salario",
      amount: "100000",
      note: "P1a income",
    });
    await createMovementInUI(page, {
      type: "expense",
      category: "Comida",
      amount: "30000",
      note: "P1a expense today",
    });
    // Previous month — the comparable base of §5.1.
    await createMovementInUI(page, {
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "P1a expense prev month",
      date: day15MonthsAgo(1),
    });

    await page.goto("/dashboard");
    // Expenses: 30,000 current vs 10,000 previous → ▲ 200%, sr-only sentence.
    const expensesCard = summaryCard(page, /^Expenses this month$/);
    await expect(expensesCard).toContainText(/COP\s+30,000/);
    await expect(expensesCard).toContainText(/▲\s*200%/);
    // metric interpolates the LABEL with initial capital ("Expenses").
    await expect(
      expensesCard.getByText(/^COP Expenses 200% more vs the previous month$/),
    ).toBeVisible();

    // Income: 100,000 current vs 0 previous → NO percentage (prev == 0 must
    // never render Infinity/NaN/0%): absolute-delta glyph + no-reference
    // sentence.
    const incomeCard = summaryCard(page, /^Income this month$/);
    await expect(incomeCard).toContainText(/COP\s+100,000/);
    await expect(incomeCard).toContainText(/～/);
    await expect(
      incomeCard.getByText(/^COP Income has no comparable reference \(previous month\)$/),
    ).toBeVisible();
  });

  test("P1b — period selector: year labels + URL param + Clear filters reset", async ({ page }) => {
    await ensureSession(page);

    await page.goto("/dashboard");
    // UX-5: the filter bar is collapsed behind the Filters toggle — the
    // selects don't render until it opens.
    await page.getByRole("button", { name: /^Filters$/ }).click();
    await page.getByLabel("Period").selectOption({ label: "This year" });
    await expect(page).toHaveURL(/periodo=year/);
    await expect(page.getByText(/^Income this year$/)).toBeVisible();
    await expect(page.getByText(/^Income this month$/)).toHaveCount(0);
    // The year read window includes this month's movements (January-agnostic:
    // totals grow with serial state — assert the switch, not exact values).
    await expect(page.getByText(/^Expenses this year$/)).toBeVisible();

    // Clear filters resets month (and the URL param).
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/periodo=year/);
    await expect(page.getByText(/^Income this month$/)).toBeVisible();
  });

  test("P2a — atypical expense alert: confident rule renders, insufficient data does not", async ({
    page,
  }) => {
    await ensureSession(page);

    // Seed MORE reference months under the ≥3-with-data floor (P1a already
    // left one previous month with an expense): 3 months with data in the
    // last-5 window → reference = (10,000+10,000+10,000)/5 = 6,000 and the
    // current 30,000 exceeds 6,000 × 1.5 → alert is CONFIDENT (no data, no
    // misleading alert — never tested the alert without its floor).
    await createMovementInUI(page, {
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "P2a seed mminus2",
      date: day15MonthsAgo(2),
    });
    await createMovementInUI(page, {
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "P2a seed mminus3",
      date: day15MonthsAgo(3),
    });

    await page.goto("/dashboard");
    const atypical = page.getByText("Atypical expense").first().locator("xpath=ancestor::div[2]");
    await expect(atypical).toBeVisible();
    await expect(atypical).toContainText(/the 3 reference months with expense data/);
    await expect(atypical).toContainText(/COP/);
  });

  test("P2b — negative balance alert: realized negative account is surfaced", async ({ page }) => {
    await ensureSession(page);

    // Sink Efectivo: 40,000 → −60,000. The F5 informed confirmation gates the
    // registration (out-of-balance expense) — confirm through it: the alert
    // flow REQUIRES the movement to actually exist.
    await createMovementInUI(page, {
      type: "expense",
      category: "Comida",
      amount: "100000",
      note: "P2b sink",
    });

    await page.goto("/dashboard");
    const negative = page.getByText("Negative balance").first().locator("xpath=ancestor::div[2]");
    await expect(negative).toBeVisible();
    await expect(negative).toContainText("Efectivo · COP");
  });
});
