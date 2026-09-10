import { NotFoundError } from '../../domain/errors';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete a payable and cascade-delete ALL linked movements (PAY-R-5).
 *
 * Movement deletion is tolerant by construction: `deleteByRefId` is a
 * `deleteMany` over every movement whose link.refId === payableId (initial
 * payment + abonos), which never throws for "not found" (it reports 0
 * deleted). Any non-NotFound repo error still propagates naturally. Deleting
 * movements first then the aggregate record keeps a failure from orphaning
 * the payable.
 *
 * R15.1 Fase 3 — transactional + idempotent:
 * The WHOLE cascade (read payable snapshot, movement deletes, payable delete)
 * runs inside `uow.withTransaction(...)`. All reads and writes join the
 * transaction session, so either the entire cascade commits or it rolls back
 * atomically — a mid-way failure can no longer leave movements deleted while
 * the payable survives.
 *
 * Idempotency under CONCURRENT/duplicate requests is guaranteed by the
 * transaction PLUS the `payableRepo.delete` NotFound: the payable is read
 * inside the transaction (snapshot), and `delete` is the final write. If a
 * second request races the first, its transaction re-executes after the
 * winner commits and the aggregate read inside it no longer finds the payable
 * → NotFoundError → clean abort with zero partial state.
 */
export async function deletePayable(
  workspaceId: string,
  payableId: string,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const payables = await payableRepo.findByWorkspaceId(workspaceId, tx);
    const payable = payables.find(p => p.id === payableId);
    if (!payable) throw new NotFoundError('Payable not found');

    // Robust format-agnostic cascade: delete every movement that references
    // the payable (payableInitialPayment + payableAbono — ObjectId or UUID
    // refIds). deleteMany is tolerant of already-missing movements (returns 0).
    await movementRepo.deleteByRefId(workspaceId, payableId, tx);

    // Final write. If the payable was deleted by a concurrent request, this
    // throws NotFoundError and the whole transaction (including the movement
    // deletes) rolls back — movements are never deleted twice.
    await payableRepo.delete(workspaceId, payableId, tx);
  });
}