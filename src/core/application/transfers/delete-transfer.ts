import { NotFoundError } from '../../domain/errors';
import type { TransferRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete a transfer and cascade-delete both linked movements (TRA-5).
 *
 * R15-F5: the whole deletion runs INSIDE a single multi-document transaction —
 * transfer + both movements commit or roll back atomically (criterion §7; the
 * transfer can never vanish leaving orphan movements, or survive with only
 * part of its movements deleted).
 *
 * Each movement delete is tolerant of an already-missing movement (the delete
 * is a cleanup of state that must not exist), but a transfer that references
 * NO live movements never exists either — the transfer read stays authoritative
 * and session-less, like the F2/F3 reads.
 */
export async function deleteTransfer(
  userId: string,
  transferId: string,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const transfer = await transferRepo.findById(userId, transferId);
    if (!transfer) throw new NotFoundError('Transfer not found');

    // Delete both movements first (reverse write order)
    if (transfer.movementIds?.expenseId) {
      try {
        await movementRepo.delete(userId, transfer.movementIds.expenseId, tx);
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
        // Already gone — the goal state is "no movement", keep going.
      }
    }
    if (transfer.movementIds?.incomeId) {
      try {
        await movementRepo.delete(userId, transfer.movementIds.incomeId, tx);
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
    }
    await transferRepo.delete(userId, transferId, tx);
  });
}