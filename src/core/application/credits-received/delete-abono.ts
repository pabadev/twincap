import { CreditReceived } from '../../domain/credit-received';
import { NotFoundError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete an embedded abono from a credit received (CRED-R-4).
 *
 * Removes the abono and reverses the linked movement.
 *
 * R15 Fase 3: aggregate read runs INSIDE the transaction (snapshot-consistent)
 * and BOTH writes (movement delete + abono $pull, R5-B order) commit or roll
 * back atomically — a mid-way failure can no longer orphan a phantom movement
 * or leave the abono half-removed.
 */
export async function deleteAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    const abono = credit.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // R5-B: reverse the linked movement FIRST, then pull the abono. Deleting
    // the movement first means a mid-way failure leaves the abono intact (debt
    // still pending, no balance inflation). Tolerant: an already-missing
    // movement is fine.
    if (abono.movementId) {
      try {
        await movementRepo.delete(workspaceId, abono.movementId, tx);
      } catch (err) {
        if (err instanceof NotFoundError) {
          // movement already gone — continue to pull the abono
        } else {
          throw err;
        }
      }
    }

    // Remove abono from embedded array (atomic $pull)
    await creditRepo.deleteAbono(workspaceId, creditId, abonoId, tx);

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
  });
}