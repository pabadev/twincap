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

  // R5-B atomicity: reverse the linked movement FIRST, then pull the abono.
  // With the old order (pull abono → delete movement) a failure between the two
  // leaves a phantom movement that still counts in balances with no matching
  // abono. Deleting the movement first means a mid-way failure leaves the abono
  // intact (debt still pending, no balance inflation). Full transactionality
  // would require a Mongoose ClientSession across every port — out of scope.
  //
  // R9/D9.1 delete: a split abono has TWO linked movements (capital primary +
  // interest). Remove BOTH before pulling the abono, following the R5-B
  // atomicity rule (movement-first: a mid-way failure leaves the abono intact
  // with no phantom balance impact — a phantom movement would be worse).
  if (abono.interestMovementId) {
    try {
      await movementRepo.delete(userId, abono.interestMovementId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        // movement already gone — continue
      } else {
        throw err;
      }
    }
  }

  // Reverse linked movement (tolerant: an already-missing movement is fine)
  if (abono.movementId) {
    try {
      await movementRepo.delete(userId, abono.movementId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        // movement already gone — continue to pull the abono
      } else {
        throw err;
      }
    }
  }

  // Remove abono from embedded array (atomic $pull)
  await creditRepo.deleteAbono(userId, creditId, abonoId);

  return new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      installmentValue: credit.installmentValue,
      frequency: credit.frequency,
      saleId: credit.saleId,
      createdAt: credit.createdAt,
    },
    credit.abonos.filter(a => a.id !== abonoId),
  );
}
