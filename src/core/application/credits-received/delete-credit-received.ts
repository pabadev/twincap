import { NotFoundError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete a credit received and cascade-delete all linked movements (CRED-R-5).
 *
 * Movement deletion is tolerant by construction: `deleteByRefId` is a
 * `deleteMany` over every movement whose link.refId === creditId (principal +
 * abonos), which never throws for "not found" (it reports 0 deleted). Any
 * non-NotFound repo error still propagates naturally. Deleting movements first
 * then the aggregate record keeps a failure from orphaning the credit.
 *
 * R15.1 Fase 3 — transactional + idempotent:
 * The WHOLE cascade (read credit snapshot, movement deletes, credit delete)
 * runs inside `uow.withTransaction(...)`. All reads and writes join the
 * transaction session, so either the entire cascade commits or it rolls back
 * atomically — a mid-way failure can no longer leave movements deleted while
 * the credit survives.
 *
 * Idempotency under CONCURRENT/duplicate requests is guaranteed by the
 * transaction PLUS the `creditRepo.delete` NotFound: the credit is read inside
 * the transaction (snapshot), and `delete` is the final write. If a second
 * request races the first, its transaction re-executes after the winner
 * commits and the aggregate read inside it no longer finds the credit →
 * NotFoundError → clean abort with zero partial state.
 */
export async function deleteCreditReceived(
  workspaceId: string,
  creditId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    // Robust format-agnostic cascade: delete every movement that references
    // the credit (creditReceivedPrincipal + creditReceivedAbono — ObjectId or
    // UUID refIds). deleteMany is tolerant of already-missing movements
    // (returns 0).
    await movementRepo.deleteByRefId(workspaceId, creditId, tx);

    // Final write. If the credit was deleted by a concurrent request, this
    // throws NotFoundError and the whole transaction (including the movement
    // deletes) rolls back — movements are never deleted twice.
    await creditRepo.delete(workspaceId, creditId, tx);
  });
}