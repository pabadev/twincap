import { NotFoundError } from '../../domain/errors';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete a payable and cascade-delete ALL linked movements (PAY-R-5).
 *
 * Finds every movement whose link.refId === payableId (initial payment +
 * abonos) and deletes them, then the payable record itself.
 */
export async function deletePayable(
  userId: string,
  payableId: string,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const payables = await payableRepo.findByUserId(userId);
  const payable = payables.find(p => p.id === payableId);
  if (!payable) throw new NotFoundError('Payable not found');

  // Find all movements linked to this payable (initial payment + abonos)
  const movements = await movementRepo.findByUserId(userId);
  const linkedMovements = movements.filter(m => m.link?.refId === payableId);

  // Atomicity note: movement deletions + record deletion are separate writes
  // inside this single use-case invocation. Full transactionality would
  // require the repository ports to accept a Mongoose ClientSession — an
  // infrastructure change deliberately out of scope here.
  for (const m of linkedMovements) {
    await movementRepo.delete(userId, m.id);
  }

  await payableRepo.delete(userId, payableId);
}
