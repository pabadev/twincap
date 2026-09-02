import { expect, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import { RateLimitModel } from '../src/infrastructure/models/rate-limit';

/**
 * R12-C3 E2E helpers (Slice 1).
 * Browser flows plus minimal DB plumbing to keep the rate-limiter and the
 * shared register:unknown counter deterministic across the suite.
 */

let seq = 0;

/** Connect lazily to the local E2E mongod (URI fed via .env.e2e). */
async function ensureDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in the E2E environment.');
  }
  const host = new URL(uri).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `E2E DB host must be loopback, got "${host}". Refusing to touch Atlas from helpers.`,
    );
  }
  await mongoose.connect(uri, { bufferCommands: false });
}

/**
 * Clear the `ratelimits` collection so the shared register:unknown counter
 * resets before each happy-path registration (allowing dozens of registers
 * without tripping the 3/15min cap).
 */
export async function clearRateLimits(): Promise<void> {
  await ensureDb();
  await RateLimitModel.deleteMany({});
}

/**
 * Register a NEW unique user via the /register UI and land on /dashboard.
 * Returns the created email. Clears `ratelimits` first so the register is
 * always allowed (happy path).
 */
export async function registerUser(
  page: Page,
  { email, password = 'Password123!' }: { email?: string; password?: string } = {},
): Promise<string> {
  await clearRateLimits();
  seq += 1;
  const uniqueEmail =
    email ?? `e2e-${Date.now()}-${seq}@test.local`;

  await page.goto('/register');
  await page.getByLabel(/^Email/i).fill(uniqueEmail);
  await page.getByLabel(/^Password/i).fill(password);
  await page.getByLabel(/^Confirm Password/i).fill(password);
  await page.getByRole('button', { name: /Register/i }).click();

  // Register redirects to / which lands authenticated users on /dashboard.
  await page.waitForURL('**/dashboard');
  return uniqueEmail;
}

/** Login through the /login UI (expects an existing user). */
export async function login(
  page: Page,
  { email, password }: { email: string; password: string },
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/^Email/i).fill(email);
  await page.getByLabel(/^Password/i).fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL('**/dashboard');
}

/**
 * Log out via the nav: open the confirmation dialog, confirm it, and arrive
 * at /login. `confirmYes` is the Nav.confirmYes label ("Log out").
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Log out/i }).click();
  await confirmDialog(page, { title: /Log out\?/i, confirm: /^Log out$/i });
  await page.waitForURL('**/login');
}

/**
 * Confirm an open modal-scoped dialog: scope to the dialog carrying `title`,
 * then click the confirm button by its accessible name.
 */
export async function confirmDialog(
  page: Page,
  { title, confirm }: { title: RegExp | string; confirm: RegExp | string },
): Promise<void> {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: confirm }).click();
}

/**
 * Poll a locator until its text equals `expected` (or matches the regex), safe
 * against the dashboard's aria-busy transition re-fetching snapshots.
 */
export async function waitForSnapshotValue(
  page: Page,
  locator: ReturnType<Page['locator']>,
  expected: string | RegExp,
): Promise<void> {
  await expect(async () => {
    await expect(locator).toBeVisible();
    const text = (await locator.textContent()) ?? '';
    if (typeof expected === 'string') {
      expect(text).toContain(expected);
    } else {
      expect(text).toMatch(expected);
    }
  }).toPass({ timeout: 15_000 });
}

/**
 * Slice 4: REAL financial seeding for the dashboard aggregation specs.
 * Creates manual income/expense movements through the /movements UI with
 * deterministic amounts and traceable notes. Amounts are COP minor units
 * ("100000" = COP 100,000). Movements land on the seeded "Efectivo" (COP)
 * account and default to today's date so the dashboard "this month" window
 * is deterministic.
 */
export interface FinancialSeed {
  /** Income movement dated today (lands in the current-month window). */
  monthlyIncome?: string;
  /** Expense movement dated today (lands in the current-month window). */
  monthlyExpense?: string;
  /** Income movement dated on an explicit civil date (e.g. this year but outside the current month). */
  datedIncome?: { amount: string; date: string };
  /** Prefix for movement notes, e.g. 'slice4' → 'slice4-income'. */
  notePrefix?: string;
}

/** Local calendar date as YYYY-MM-DD (same convention as the movement form default). */
function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Open the "New Movement" dialog and submit one manual movement.
 * The dialog remounts on every open, so each call gets a fresh form mount
 * and a fresh idempotency key (idempotency is mount-scoped).
 */
async function createManualMovementInUI(
  page: Page,
  {
    type,
    category,
    amount,
    date,
    note,
  }: {
    type: 'income' | 'expense';
    category: string;
    amount: string;
    date: string;
    note: string;
  },
): Promise<void> {
  await page.goto('/movements');
  await page.getByRole('button', { name: 'Add Movement' }).click();
  const dialog = page.getByRole('dialog', { name: /New Movement/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Account').selectOption({ label: 'Efectivo (COP)' });
  await dialog
    .getByLabel('Type')
    .selectOption({ label: type === 'income' ? 'Income' : 'Expense' });
  await dialog.getByLabel('Category').selectOption({ label: category });
  await dialog.getByLabel('Amount').fill(amount);
  await dialog.getByLabel('Note').fill(note);
  // Anchored so "Date" never substring-matches a sibling field label.
  await dialog.getByLabel(/^Date/).fill(date);
  // Dialog-scoped: the page header also has an "Add Movement" button.
  await dialog.getByRole('button', { name: 'Add Movement' }).click();

  await expect(dialog).toBeHidden();
}

/**
 * Seed known-balance financial data through the real UI: manual income and/or
 * expense movements on "Efectivo" (COP). Used by the dashboard aggregates and
 * filter re-fetch specs; notes carry `notePrefix` so lists stay traceable.
 */
export async function seedFinancialData(
  page: Page,
  seed: FinancialSeed = {},
): Promise<void> {
  const prefix = seed.notePrefix ?? 'seed';
  const today = todayInputValue();

  if (seed.monthlyIncome) {
    await createManualMovementInUI(page, {
      type: 'income',
      category: 'Salario',
      amount: seed.monthlyIncome,
      date: today,
      note: `${prefix}-income`,
    });
  }
  if (seed.monthlyExpense) {
    await createManualMovementInUI(page, {
      type: 'expense',
      category: 'Comida',
      amount: seed.monthlyExpense,
      date: today,
      note: `${prefix}-expense`,
    });
  }
  if (seed.datedIncome) {
    await createManualMovementInUI(page, {
      type: 'income',
      category: 'Salario',
      amount: seed.datedIncome.amount,
      date: seed.datedIncome.date,
      note: `${prefix}-income-${seed.datedIncome.date}`,
    });
  }
}
