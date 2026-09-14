import { CreditReceived } from '../../domain/credit-received';
import { NotFoundError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { touchAccount } from '../financial/touch-accounts';

/**
 * Delete an embedded abono from a credit received (CRED-R-4).
 *
 * Removes the abono and reverses the linked movement.
 *
 * R15 Fase 3: aggregate read runs INSIDE the transaction (snapshot-consistent)
 * and BOTH writes (movement delete + abono $pull, R5-B order) commit or roll
 * back atomically — a mid-way failure can no longer orphan a phantom movement
 * or leave the abono half-removed.
 *
 * R15.3.2 Fase 4: deleting the abono reverses its movement, so the account's
 * derived balance changes — the account is touched as the LAST write of the
 * transaction (shared-document conflict point, R15.1-6e). Unconditional (the
 * tolerant already-missing-movement path is a legacy edge; an account that
 * holds the abono's movements is protected by the ACC-4 delete guard anyway,
 * so the touch is a harmless no-op there).
 */
export async function deleteAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
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
    await creditRepo.deleteAbono(workspaceId, creditId, abonoId, tx, credit.version);

    // R15.3.2: touch the account as the LAST write (balance-affecting delete).
    await touchAccount(accountRepo, workspaceId, abono.accountId, tx);

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
        version: credit.version + 1,
      },
      credit.abonos.filter(a => a.id !== abonoId),
    );
  });
}