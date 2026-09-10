import type { MovementRepository } from '../domain/repositories';
import type { LiveBalanceDeps } from './movements/compute-live-balance';
import { resolveLiveParentsForMovements } from './movements/compute-live-balance';
import { filterMovementsWithLiveParents, accountBalancesFromMovements } from './movements/index';

/**
 * Balance aggregation service.
 *
 * Balances are DERIVED from the sum of movement signedAmounts per account
 * (design rev.2 §2). There is no stored balance field.
 *
 * R15.2: the read applies the canonical live-parent filter (the same
 * R6-P1/R7-A orphan semantics the dashboard uses) — movements whose linked
 * parent was deleted without cascade never affect the derived balance.
 */

/**
 * Get balances for ALL accounts belonging to a user.
 * Returns a Map<accountId, balance>.
 *
 * Implementation (R15.2): fetches the full workspace movement history
 * (minimal projection) and resolves every distinctive link parent ONCE
 * (serial reads — the MongoDB driver forbids concurrent ops on a session),
 * then filters and groups by account in memory. The provided `accounts` are
 * the live account set (already loaded by the caller): opening movements
 * survive the filter because their refId IS the account id.
 */
export async function getUserBalances(
  workspaceId: string,
  accounts: Array<{ id: string }>,
  movementRepo: MovementRepository,
  deps: LiveBalanceDeps,
): Promise<Map<string, number>> {
  const movements = await movementRepo.findByWorkspaceIdForBalance(workspaceId);
  const live = await resolveLiveParentsForMovements(workspaceId, movements, deps, accounts);
  const liveMovements = filterMovementsWithLiveParents(movements, live);
  return accountBalancesFromMovements(accounts, liveMovements);
}