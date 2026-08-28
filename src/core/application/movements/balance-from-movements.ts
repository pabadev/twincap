import type { Movement } from '../../domain/movement';

/**
 * Balance per account summed from an already live (parent-filtered) movement
 * list.
 *
 * R7-A: the dashboard derives each account's balance from the movements that
 * survive `filterMovementsWithLiveParents` (P1) instead of summing every
 * movement including orphans. Summing `signedAmount` over a live list excludes
 * orphan movements (deleted parents that failed to cascade), so the Balance
 * total and the Activos/Patrimonio cards no longer get inflated by leftovers
 * the movements table already hides.
 *
 * Movements without a `link` (manual movements) are always live and thus
 * included — the caller is responsible for passing a list already filtered by
 * parent liveness.
 */
export function accountBalancesFromMovements(
  accounts: { id: string }[],
  movements: Movement[],
): Map<string, number> {
  const balance = new Map<string, number>();
  for (const m of movements) {
    balance.set(m.accountId, (balance.get(m.accountId) ?? 0) + m.signedAmount);
  }
  return balance;
}
