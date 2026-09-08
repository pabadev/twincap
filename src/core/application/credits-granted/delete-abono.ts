import { CreditGranted } from '../../domain/credit-granted';
import { NotFoundError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete an embedded abono from a credit granted (CRED-G-4).
 *
 * Removes the abono and reverses the linked movement.
 *
 * R15 Fase 3: aggregate read runs INSIDE the transaction (snapshot-consistent)
 * and ALL writes (interest + primary movement deletes + abono $pull, R5-B
 * order) commit or roll back atomically — a mid-way failure can no longer
 * orphan a phantom movement or leave the abono half-removed.
 */
export async function deleteAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<CreditGranted> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    const abono = credit.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // R5-B: reverse the linked movements FIRST, then pull the abono. A split
    // abono has TWO linked movements (capital primary + interest) — removed in
    // R5-B order so a mid-way failure leaves the abono intact with no phantom
    // balance impact. Tolerant: an already-missing movement is fine.
    if (abono.interestMovementId) {
      try {
        await movementRepo.delete(workspaceId, abono.interestMovementId, tx);
      } catch (err) {
        if (err instanceof NotFoundError) {
          // movement already gone — continue
        } else {
          throw err;
        }
      }
    }

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

    return new CreditGranted(
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
        saleId: credit.saleId,
        createdAt: credit.createdAt,
      },
      credit.abonos.filter(a => a.id !== abonoId),
    );
  });
}