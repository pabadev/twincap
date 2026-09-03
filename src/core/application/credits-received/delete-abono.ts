import { CreditReceived } from '../../domain/credit-received';
import { NotFoundError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete an embedded abono from a credit received (CRED-R-4).
 *
 * Removes the abono and reverses the linked movement.
 */
export async function deleteAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
): Promise<CreditReceived> {
  const credits = await creditRepo.findByWorkspaceId(workspaceId);
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
  // Reverse linked movement (tolerant: an already-missing movement is fine)
  if (abono.movementId) {
    try {
      await movementRepo.delete(workspaceId, abono.movementId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        // movement already gone — continue to pull the abono
      } else {
        throw err;
      }
    }
  }

  // Remove abono from embedded array (atomic $pull)
  await creditRepo.deleteAbono(workspaceId, creditId, abonoId);

  return new CreditReceived(
    {
      id: credit.id,
      workspaceId: credit.workspaceId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      installmentValue: credit.installmentValue,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    credit.abonos.filter(a => a.id !== abonoId),
  );
}
