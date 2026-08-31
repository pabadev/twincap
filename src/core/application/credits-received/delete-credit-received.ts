import { NotFoundError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete a credit received and cascade-delete all linked movements (CRED-R-5).
 *
 * Deletes principal movement + all abono movements, then the credit record.
 */
export async function deleteCreditReceived(
  userId: string,
  creditId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // Find all movements linked to this credit (principal + abonos)
  const movements = await movementRepo.findByUserId(userId);
  const linkedMovements = movements.filter(m => m.link?.refId === creditId);

  // Movement deletion is tolerant (R5-B pattern): an already-missing movement
  // (prior cleanup) must not block the credit deletion. Deleting movements
  // first then the record keeps a failure from orphaning the credit.
  for (const m of linkedMovements) {
    try {
      await movementRepo.delete(userId, m.id);
    } catch (err) {
      if (err instanceof NotFoundError) continue;
      throw err;
    }
  }

  await creditRepo.delete(userId, creditId);
}
