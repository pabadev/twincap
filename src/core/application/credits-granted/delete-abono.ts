import { CreditGranted } from '../../domain/credit-granted';
import { NotFoundError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { touchAccount } from '../financial/touch-accounts';

/**
 * Delete an embedded abono from a credit granted (CRED-G-4).
 *
 * Removes the abono and reverses the linked movement.
 *
 * R15 Fase 3: aggregate read runs INSIDE the transaction (snapshot-consistent)
 * and ALL writes (interest + primary movement deletes + abono $pull, R5-B
 * order) commit or roll back atomically — a mid-way failure can no longer
 * orphan a phantom movement or leave the abono half-removed.
 *
 * R15.3.2 Fase 4: deleting the abono reverses its movements (interest + primary
 * live on the same account), so the account's derived balance changes — the
 * account is touched as the LAST write of the transaction (shared-document
 * conflict point, R15.1-6e). Unconditional: the tolerant already-missing-
 * movement paths are legacy edges; an account that holds the abono's movements
 * is protected by the ACC-4 delete guard anyway, so the touch is a harmless
 * no-op there.
 */
export async function deleteAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
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
    await creditRepo.deleteAbono(workspaceId, creditId, abonoId, tx, credit.version);

    // R15.3.2: touch the account as the LAST write (balance-affecting delete).
    await touchAccount(accountRepo, workspaceId, abono.accountId, tx);

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
        version: credit.version + 1,
      },
      credit.abonos.filter(a => a.id !== abonoId),
    );
  });
}