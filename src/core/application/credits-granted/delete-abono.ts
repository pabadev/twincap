import { CreditGranted } from '../../domain/credit-granted';
import { NotFoundError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete an embedded abono from a credit granted (CRED-G-4).
 *
 * Removes the abono and reverses the linked movement.
 */
export async function deleteAbono(
  userId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
): Promise<CreditGranted> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  const abono = credit.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // Remove abono from embedded array (atomic $pull)
  await creditRepo.deleteAbono(userId, creditId, abonoId);

  // Reverse linked movement
  if (abono.movementId) {
    await movementRepo.delete(userId, abono.movementId);
  }

  return new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    credit.abonos.filter(a => a.id !== abonoId),
  );
}
