import type { Movement, MovementLinkKind } from "../domain/movement";

/**
 * Financing capital movements that NEVER represent economic result
 * (decision D2, refined in round 8):
 * - `creditReceivedPrincipal`: disbursement of a credit you RECEIVE — it is
 *   debt, not income (excluded from income).
 * - `creditGrantedPrincipal`: money you lend to a third party — it is an
 *   asset, not an expense (excluded from expenses).
 */
export const FINANCING_CAPITAL_LINK_KINDS: ReadonlySet<MovementLinkKind> =
  new Set(["creditReceivedPrincipal", "creditGrantedPrincipal"] as const);

/**
 * Link kinds that do NOT count toward the economic result.
 *
 * Beyond financing capital (the two credit principals), the aggregators also
 * exclude internal flows whose legs only move money between own accounts:
 * - `transfer`: moving money between own accounts changes WHERE money is,
 *   not the financial outcome (both legs excluded).
 * - `opening`: seeding an account with its starting balance is not income.
 */
export const NON_ECONOMIC_LINK_KINDS: ReadonlySet<MovementLinkKind> = new Set([
  "transfer",
  "opening",
  ...FINANCING_CAPITAL_LINK_KINDS,
]);

/**
 * True when a movement counts toward the economic result (income/expenses).
 *
 * Excluded: financing capital (credit principals) and internal flows
 * (transfers, opening balances). Everything else keeps its current treatment:
 * credit abonos (received/granted, in any context), sale payments, and
 * payable payments still count.
 *
 * Accepts any object exposing `link` so both domain `Movement` instances and
 * serialized movement snapshots can be passed.
 */
export function countsTowardEconomicResult(
  movement: Pick<Movement, "link">,
): boolean {
  return !(movement.link && NON_ECONOMIC_LINK_KINDS.has(movement.link.kind));
}