import { NotFoundError } from '../../domain/errors';
import type { TransferRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete a transfer and cascade-delete both linked movements (TRA-5).
 *
 * Movements are deleted first (reverse write order), then the transfer.
 * This prevents orphaned movements if the transfer deletion fails.
 */
export async function deleteTransfer(
  userId: string,
  transferId: string,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const transfer = await transferRepo.findById(userId, transferId);
  if (!transfer) throw new NotFoundError('Transfer not found');

  // Delete both movements first (reverse write order)
  if (transfer.movementIds?.expenseId) {
    await movementRepo.delete(userId, transfer.movementIds.expenseId);
  }
  if (transfer.movementIds?.incomeId) {
    await movementRepo.delete(userId, transfer.movementIds.incomeId);
  }
  await transferRepo.delete(userId, transferId);
}
