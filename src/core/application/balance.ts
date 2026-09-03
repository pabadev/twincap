import type { MovementRepository } from "../domain/repositories";

/**
 * Balance aggregation service.
 *
 * Balances are DERIVED from the sum of movement signedAmounts per account
 * (design rev.2 §2). There is no stored balance field.
 *
 * Request-scoped memo (React.cache or per-request Map) will be wired
 * in Phase 7 (app wiring). This module provides the pure aggregation logic.
 */

/**
 * Get the balance of a single account: Σ signedAmount for all its movements.
 * Returns 0 when the account has no movements.
 */
export async function getAccountBalance(
  workspaceId: string,
  accountId: string,
  movementRepo: MovementRepository,
): Promise<number> {
  return movementRepo.aggregateBalance(workspaceId, accountId);
}

/**
 * Get balances for ALL accounts belonging to a user.
 * Returns a Map<accountId, balance>.
 *
 * Implementation: fetches all user movements and groups by accountId in memory.
 * This is acceptable for the foundation; request-scoped memo and optimization
 * will be added in Phase 7.
 */
export async function getUserBalances(
  workspaceId: string,
  movementRepo: MovementRepository,
): Promise<Map<string, number>> {
  const movements = await movementRepo.findByWorkspaceId(workspaceId);
  const balances = new Map<string, number>();

  for (const m of movements) {
    const current = balances.get(m.accountId) ?? 0;
    balances.set(m.accountId, current + m.signedAmount);
  }

  return balances;
}
