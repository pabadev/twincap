import { test, expect, type Locator, type Page } from "@playwright/test";
import { registerUser, confirmMoneyAction } from "./helpers";

/**
 * UX-6 F5 (movements) — informed confirmation for projected-negative expenses
 * (design §5 scenario I; tasks WU5 5.2). Runs serially against the local
 * mongod + production `next start`; locale EN (labels asserted in English).
 *
 * Binding scenarios (founder scope — F5 is purely informational, NEVER
 * blocks; the ONLY gate is expense + projected negative):
 *  - expense projecting a negative balance → F5 dialog with the projected row
 *    highlighted → confirm → movement registered EXACTLY once;
 *  - expense within balance → DIRECT native submit, no dialog;
 *  - income → no dialog even with a low balance;
 *  - cancel → nothing dispatched, the form stays populated;
 *  - ESC closes the confirmation without dispatching;
 *  - double-clicking "Register anyway" still writes exactly ONE movement
 *    (the re-dispatch reuses the SAME captured FormData / SAME idempotency
 *    key — design D9 — and the confirm button goes loading/disabled).
 */

type Credentials = { email: string; password: string };

async function freshUser(page: Page): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: "Password123!" };
}

/** Set the initial balance of an account that has no movements yet. */
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
  // UX-6: confirm the informed-confirmation dialog that opens over the form.
  await confirmMoneyAction(page);
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

/** Dialog-scoped locator for the F5 negative-balance confirmation. */
function f5Dialog(page: Page): Locator {
  return page.getByRole("dialog", {
    name: /Insufficient balance in the account/i,
  });
}

/**
 * Open the New Movement dialog and fill the manual-movement fields.
 * Returns the dialog locator so callers can submit / assert survival.
 */
async function openMovementDialog(
  page: Page,
  {
    account,
    type,
    category,
    amount,
    note,
  }: {
    account: string;
    type: "income" | "expense";
    category: string;
    amount: string;
    note: string;
  },
): Promise<Locator> {
  await page.goto("/movements");
  await page.getByRole("button", { name: "Add Movement" }).click();
  const dialog = page.getByRole("dialog", { name: /New Movement/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Account").selectOption({ label: `${account} (COP)` });
  await dialog.getByLabel("Type").selectOption({ label: type === "income" ? "Income" : "Expense" });
  await dialog.getByLabel("Category", { exact: true }).selectOption({ label: category });
  await dialog.getByLabel("Amount").fill(amount);
  await dialog.getByLabel("Note").fill(note);
  // Settle budget: the F5 gate reads `balances` from the on-mount
  // `listAccountBalancesAction` fetch, which has NO DOM loading signal (design
  // D5 — fail-open by construction). Submitting before it resolves would
  // silently skip the dialog and dispatch directly; the pause makes the gate
  // decision deterministic under serial-suite load.
  await page.waitForTimeout(2_000);
  return dialog;
}

async function expectAccountBalance(
  page: Page,
  accountName: string,
  copAmount: string,
): Promise<void> {
  await page.goto("/accounts");
  const row = page.locator("[data-id]", { hasText: accountName });
  // `formatAmount` renders "COP 10,000" (COP exponent 0, no decimals) with
  // Intl NBSP between code and number — `\s+`-safe regex over the amount.
  await expect(row).toContainText(copAmount);
}

test.describe("UX-6 F5 — movements negative-balance confirmation", () => {
  test.describe.configure({ mode: "serial" });

  test("expense projecting negative balance confirms through dialog and registers once", async ({
    page,
  }) => {
    await freshUser(page);
    await setInitialBalanceInUI(page, "Efectivo", "5000");

    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "f5-confirm",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    // The F5 confirmation appears with the projected ("New balance") row
    // highlighted as negative: 5,000 − 10,000 → −COP 5,000.
    const f5 = f5Dialog(page);
    await expect(f5).toBeVisible();
    await expect(f5.getByText("New balance")).toBeVisible();
    await expect(f5.getByText(/[−-]COP\s+5,000/)).toBeVisible();
    // Design D3: initial focus lands on the confirm button.
    await expect(f5.getByRole("button", { name: "Register anyway" })).toBeFocused();

    // Confirm → the SAME captured FormData re-dispatches (one write).
    await f5.getByRole("button", { name: "Register anyway" }).click();
    await expect(f5).toBeHidden();
    await expect(dialog).toBeHidden();

    // Write barrier (load-root-caused 2026-09-16): the F5 dialog close is
    // optimistic — the shared hook hides it on click, so "dialog hidden" is
    // NOT proof the create POST completed. Under serial-suite load the
    // dispatch can outlive the dialogs; the goto below then aborted the
    // in-flight POST (Playwright network trace: status -1) and the movement
    // was never persisted (fresh /movements render showed no row). The only
    // reliable commit signal is the refreshed list on THIS page showing the
    // row (success effect → router.refresh() → server re-render from the DB).
    await expect(page.locator("[data-id]", { hasText: "f5-confirm" })).toContainText(
      /[−-]COP\s+10,000/,
      {
        timeout: 60_000,
      },
    );

    // Exactly one movement row with the traceable note.
    await page.goto("/movements");
    const row = page.locator("[data-id]", { hasText: "f5-confirm" });
    await expect(row).toContainText(/[−-]COP\s+10,000/);
    // Visible-only: the mobile card variant duplicates the note hidden
    // (display:none) beside the desktop table since UX-7 WU-1.
    await expect(
      page.getByText("f5-confirm", { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);

    // The derived account balance is negative — nothing was blocked.
    await page.goto("/accounts");
    await expect(page.locator("[data-id]", { hasText: "Efectivo" }).first()).toContainText(
      /-COP\s+5,000/,
    );
  });

  test("expense within balance submits directly — no confirmation dialog", async ({ page }) => {
    await freshUser(page);
    await setInitialBalanceInUI(page, "Efectivo", "5000");

    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "expense",
      category: "Comida",
      amount: "3000",
      note: "f5-sufficient",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    // Projected 5,000 − 3,000 = 2,000 ≥ 0 → native direct submit. The dialog
    // closing proves the submit completed; the F5 dialog never rendered.
    await expect(dialog).toBeHidden();
    await expect(f5Dialog(page)).toHaveCount(0);

    // Movement registered; balance reflects the expense.
    await page.goto("/movements");
    await expect(page.locator("[data-id]", { hasText: "f5-sufficient" })).toContainText(
      /[−-]COP\s+3,000/,
    );
    await expectAccountBalance(page, "Efectivo", "2,000");
  });

  test("income never gates — no dialog even with a low balance", async ({ page }) => {
    await freshUser(page);

    // Fresh user: Efectivo has no balance at all (account exists with 0).
    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "income",
      category: "Salario",
      amount: "100000",
      note: "f5-income",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    await expect(dialog).toBeHidden();
    await expect(f5Dialog(page)).toHaveCount(0);

    // Movement registered; balance reflects the income.
    await page.goto("/movements");
    await expect(page.locator("[data-id]", { hasText: "f5-income" })).toContainText(
      /\+?COP\s+100,000/,
    );
    await expectAccountBalance(page, "Efectivo", "100,000");
  });

  test("cancelling the F5 dialog registers nothing and keeps the form populated", async ({
    page,
  }) => {
    await freshUser(page);
    await setInitialBalanceInUI(page, "Efectivo", "5000");

    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "f5-cancel",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    const f5 = f5Dialog(page);
    await expect(f5).toBeVisible();
    await f5.getByRole("button", { name: "Cancel" }).click();
    await expect(f5).toBeHidden();

    // The form stays open and populated; nothing was dispatched.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Amount")).toHaveValue("10000");

    // No movement was created and the balance is unchanged.
    await page.goto("/movements");
    await expect(page.getByText("f5-cancel", { exact: true })).toHaveCount(0);
    await expectAccountBalance(page, "Efectivo", "5,000");
  });

  test("ESC closes the F5 confirmation without dispatching", async ({ page }) => {
    await freshUser(page);
    await setInitialBalanceInUI(page, "Efectivo", "5000");

    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "expense",
      category: "Comida",
      amount: "10000",
      note: "f5-esc",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    const f5 = f5Dialog(page);
    await expect(f5).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(f5).toBeHidden();

    // ESC closes the confirmation (and, by the Modal-stack design precedent,
    // the underlying movement dialog) without ever dispatching.
    await page.goto("/movements");
    await expect(page.getByText("f5-esc", { exact: true })).toHaveCount(0);
  });

  test("double-clicking Register anyway writes exactly one movement", async ({ page }) => {
    await freshUser(page);
    await setInitialBalanceInUI(page, "Efectivo", "5000");

    const dialog = await openMovementDialog(page, {
      account: "Efectivo",
      type: "expense",
      category: "Comida",
      amount: "6000",
      note: "f5-double",
    });
    await dialog.getByRole("button", { name: "Add Movement" }).click();

    const f5 = f5Dialog(page);
    await expect(f5).toBeVisible();

    // Two rapid clicks: the first dispatches and the button goes
    // loading/disabled (hook isPending guard + Button loading); whether or
    // not the second lands, the captured FormData carries the SAME
    // idempotency key — the write is deduplicated to exactly one.
    const confirmBtn = f5.getByRole("button", { name: "Register anyway" });
    await confirmBtn.click();
    await confirmBtn.click({ timeout: 2_000 }).catch(() => {});
    await expect(f5).toBeHidden();

    // Same write barrier as the confirm test: the F5 close is optimistic, so
    // wait for the commit to land on THIS page before navigating away.
    await expect(page.locator("[data-id]", { hasText: "f5-double" })).toHaveCount(1, {
      timeout: 60_000,
    });

    await page.goto("/movements");
    // Visible-only: the mobile card variant duplicates the note hidden
    // (display:none) beside the desktop table since UX-7 WU-1.
    await expect(
      page.getByText("f5-double", { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
  });
});
