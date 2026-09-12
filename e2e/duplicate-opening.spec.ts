import { test, expect, type Page } from '@playwright/test';
import {
  registerUser,
  connectE2eDb,
  workspaceIdOf,
  accountIdOf,
  openingMovementsOf,
} from './helpers';

/**
 * R15.3 §11 — Opening duplicado (closing E2E).
 * Runs serially (workers: 1) against a local mongod + production `next start`.
 * Default test locale is `en` (NEXT_LOCALE from .env.e2e).
 *
 * Scenario under test: two CONCURRENT "Set Initial Balance" submissions for the
 * SAME account (two tabs in the same context → one session, two form mounts →
 * two distinct idempotency keys). Exactly ONE must win:
 *  - winner: dialog closes + success toast "Initial balance set successfully";
 *  - loser: `ConflictError('Account already has an initial balance')` →
 *    `error.conflict` → error toast "A resource with that data already exists"
 *    and its dialog STAYS OPEN;
 *  - DB-level (ACC-2 §4 backstop): exactly ONE `opening` movement for that
 *    account, amount = the winner's submitted amount, and that same amount is
 *    the initial balance displayed on the winner's accounts row.
 */

type Credentials = { email: string; password: string };

async function freshUser(page: Page): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await registerUser(page, { email });
  return { email, password: 'Password123!' };
}

/** Create a COP account with 0 initial balance via the /accounts dialog. */
async function createAccountInUI(
  page: Page,
  name: string,
): Promise<void> {
  await page.goto('/accounts');
  await page.getByRole('button', { name: /Add Account/i }).click();
  const dialog = page.getByRole('dialog', { name: /Add Account/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account Name').fill(name);
  await dialog.getByLabel('Initial Balance').fill('0');
  await dialog.getByRole('button', { name: /Create Account/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

/**
 * Open the "Set Initial Balance" dialog on `page` for `accountName` and fill
 * the amount WITHOUT submitting (also fills the hidden accountId field is done
 * server-side; the idempotency key is generated per form mount).
 */
async function openSetInitialBalanceFilled(
  page: Page,
  accountName: string,
  amount: string,
): Promise<void> {
  const row = page.locator('tr', { hasText: accountName });
  await row.getByRole('button', { name: /Set Initial Balance/i }).click();
  const dialog = page.getByRole('dialog', { name: /Set Initial Balance/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Balance to set').fill(amount);
}

/**
 * Whichever of the two tabs' dialogs CLOSES first is the WINNER — the success
 * useEffect closes it (setShowForm(false)); the LOSER's dialog STAYS OPEN
 * (its error path only fires a transient toast). Deterministic and persistent,
 * unlike toast text that auto-dismisses after 4s.
 */
type TabKey = 'a' | 'b';

async function detectWinner(
  pageA: Page,
  pageB: Page,
  dialogA: ReturnType<Page['locator']>,
  dialogB: ReturnType<Page['locator']>,
): Promise<TabKey> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const aClosed = (await dialogA.count()) === 0;
    const bClosed = (await dialogB.count()) === 0;
    if (aClosed !== bClosed) return aClosed ? 'a' : 'b';
    await pageA.waitForTimeout(200);
  }
  throw new Error(
    'Concurrent Set Initial Balance did not resolve to exactly one winner: ' +
      `pageA dialog open=${(await dialogA.count()) > 0}, pageB dialog open=${(await dialogB.count()) > 0}`,
  );
}

/** Reproduce `formatAmount` for a positive COP minor-unit value (en locale). */
function formatCopMinor(amount: number): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

test.describe('R15.3 §11 — Opening duplicado', () => {
  test.describe.configure({ mode: 'serial' });

  test('concurrent Set Initial Balance: one wins, one is rejected, one opening in DB', async ({
    page,
    context,
  }) => {
    const { email } = await freshUser(page);
    await createAccountInUI(page, 'Caja Concurso');

    // Second tab: same context (shared session cookie), its own page/state.
    const pageB = await context.newPage();
    await pageB.goto('/accounts');
    await expect(
      pageB.locator('tr', { hasText: 'Caja Concurso' }),
    ).toBeVisible();

    // Fill BOTH dialogs with different amounts (10,000 vs 20,000) and submit
    // concurrently — two distinct idempotency keys (per form mount).
    await openSetInitialBalanceFilled(page, 'Caja Concurso', '10000');
    await openSetInitialBalanceFilled(pageB, 'Caja Concurso', '20000');
    const dialogA = page.getByRole('dialog', { name: /Set Initial Balance/i });
    const dialogB = pageB.getByRole('dialog', { name: /Set Initial Balance/i });

    await Promise.all([
      dialogA.getByRole('button', { name: 'Set Initial Balance' }).click(),
      dialogB.getByRole('button', { name: 'Set Initial Balance' }).click(),
    ]);

    // Exactly one tab succeeds; the other is rejected. Winner = dialog closed
    // (success effect), loser = dialog stays open. The loser's conflict toast
    // is transient (4s auto-dismiss) — do NOT assert toast text here; the
    // rejection is proven by the loser dialog staying open and, at DB level,
    // by exactly ONE opening movement (assertions below).
    const winnerKey = await detectWinner(page, pageB, dialogA, dialogB);
    const loserDialog = winnerKey === 'a' ? dialogB : dialogA;

    // The loser's dialog stays open so the user can retry with another value.
    await expect(loserDialog).toBeVisible();

    // DB-level (ACC-2 §4 backstop): exactly ONE opening movement exists.
    await connectE2eDb();
    const workspaceId = await workspaceIdOf(email);
    const accountId = await accountIdOf(workspaceId, 'Caja Concurso');
    const openings = await openingMovementsOf(workspaceId, accountId);
    expect(openings).toHaveLength(1);
    const winnerAmount = openings[0]?.amount ?? 0;
    expect([10_000, 20_000]).toContain(winnerAmount);

    // The winner's UI shows the recorded initial balance as the account's
    // derived balance, and the "Set Initial Balance" action is gone.
    const winnerPage = winnerKey === 'a' ? page : pageB;
    await winnerPage.goto('/accounts');
    const winnerRow = winnerPage.locator('tr', { hasText: 'Caja Concurso' });
    await expect(winnerRow).toContainText(formatCopMinor(winnerAmount));
    await expect(
      winnerRow.getByRole('button', { name: /Set Initial Balance/i }),
    ).toHaveCount(0);
  });
});