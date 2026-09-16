/**
 * F5 (movements) — pure decision engine for the negative-balance preview.
 *
 * Purely informational (design UX-6 §1): this module NEVER blocks a submit —
 * it only decides whether the movement form should surface the informed
 * confirmation modal for a projected-negative expense. The server action
 * `createMovementAction` has no balance guard.
 *
 * Fail-open rule (UX-6 D6): any situation where a truthful comparison is
 * impossible (unknown balance, unknown account, cross-currency mismatch)
 * resolves to "do NOT show the modal" — the form keeps its native submit.
 * No fake conversion, no arithmetic across different currencies.
 *
 * All amounts are integer minor units (repo convention) — plain integer
 * subtraction, no floats.
 */

/** accountId → live derived balance + account currency (minor units). */
export type AccountBalancesMap = Record<string, { balance: number; currency: string }>;

/**
 * Project the account balance after an operation: `currentBalance - amount`.
 *
 * Returns `undefined` (fail-open) when the current balance is missing or not
 * a finite number — the caller has no truthful baseline to compare against.
 */
export function computeProjectedBalance(
  currentBalance: number | undefined,
  amount: number,
): number | undefined {
  if (typeof currentBalance !== "number" || !Number.isFinite(currentBalance)) {
    return undefined;
  }
  return currentBalance - amount;
}

/** Decision input for {@link shouldShowF5}. */
interface ShouldShowF5Input {
  /** Current account balance (minor units); `undefined` when the account has no live balance. */
  currentBalance: number | undefined;
  /** Movement amount in minor units (positive for expenses). */
  amount: number;
  /** Currency of the movement being submitted. */
  currency: string;
  /** Currency of the account; `undefined` when the account entry is unknown. */
  accountCurrency: string | undefined;
  /** Only expenses gate on a projected negative balance (founder binding). */
  isExpense: boolean;
}

/**
 * Decide whether the F5 confirmation modal should be shown for a movements
 * submit. Returns `true` ONLY for an expense whose projected balance would
 * go below zero with a known balance in the SAME currency as the movement.
 *
 * - Income/transfer → `false` (never gates).
 * - Cross-currency (account present with a different currency) → `false`
 *   (D6 fail-open — comparing minor units across currencies is wrong math).
 * - Unknown balance → `false` (fail-open).
 */
export function shouldShowF5(input: ShouldShowF5Input): boolean {
  const { currentBalance, amount, currency, accountCurrency, isExpense } = input;
  if (!isExpense) return false;
  if (accountCurrency !== undefined && accountCurrency !== currency) return false;
  const projected = computeProjectedBalance(currentBalance, amount);
  return projected !== undefined && projected < 0;
}
