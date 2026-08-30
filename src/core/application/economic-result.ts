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
 *
 * Round 9 adds the standalone granted abono (`creditGrantedAbono`): for a
 * credit granted standalone (no POS sale), each abono first recovers the
 * principal lent — recovering capital is NOT income, so the base abono is
 * excluded here. Its interest over-and-above the principal is captured by the
 * separate kind `creditGrantedAbonoInterest` (income), and an unrecovered
 * capital write-off by `creditGrantedWriteOff` (expense) — both REMAIN
 * economic (NOT in this set). For a sale-born credit (POS sale), BOTH the
 * initial payment and the subsequent abonos use `creditGrantedAbono` with
 * context 'Business' (commercial activity) and therefore count toward the
 * result (they are commercial income, not capital recovery). Only the
 * standalone abono (context 'Personal') is capital recovery and is excluded
 * here.
 */
export const NON_ECONOMIC_LINK_KINDS: ReadonlySet<MovementLinkKind> = new Set([
  "transfer",
  "opening",
  "creditGrantedAbono",
  ...FINANCING_CAPITAL_LINK_KINDS,
]);

/**
 * True when a movement counts toward the economic result (income/expenses).
 *
 * Excluded: financing capital (credit principals), the standalone granted
 * abono (capital recovery), and internal flows (transfers, opening balances).
 * Everything else keeps its current treatment: received credit abonos, granted
 * interest (`creditGrantedAbonoInterest`), write-offs (`creditGrantedWriteOff`),
 * and payable payments still count.
 *
 * Special case — `creditGrantedAbono` by context (R9): the standalone granted
 * abono (context 'Personal') only recovers the principal lent, so it is NOT
 * income and falls in NON_ECONOMIC_LINK_KINDS. But the SAME kind is reused by
 * a sale-born credit (context 'Business', D3-bis): ALL its abonos — the POS
 * initial payment AND the later abonos — are commercial income, so the
 * Business variant always remains economic.
 *
 * Accepts any object exposing `link` so both domain `Movement` instances and
 * serialized movement snapshots can be passed.
 */
export function countsTowardEconomicResult(
  movement: Pick<Movement, "link" | "context">,
): boolean {
  if (!movement.link) return true;
  // All sale-born abonos (POS initial payment and subsequent ones) carry
  // context Business and thus count; standalone recovery is always Personal
  // and does not, so keep Business economic here.
  if (movement.link.kind === "creditGrantedAbono" && movement.context === "Business") {
    return true;
  }
  return !NON_ECONOMIC_LINK_KINDS.has(movement.link.kind);
}