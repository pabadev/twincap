import { Payable } from '../../domain/payable';
import { NotFoundError } from '../../domain/errors';
import type { PayableRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { touchAccount } from '../financial/touch-accounts';

/**
 * Delete an embedded abono from a payable (PAY-R-3).
 *
 * Removes the abono and reverses the linked movement via abono.movementId.
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
  payableId: string,
  abonoId: string,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Payable> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const payables = await payableRepo.findByWorkspaceId(workspaceId, tx);
    const payable = payables.find(p => p.id === payableId);
    if (!payable) throw new NotFoundError('Payable not found');

    const abono = payable.abonos.find(a => a.id === abonoId);
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
    await payableRepo.deleteAbono(workspaceId, payableId, abonoId, tx, payable.version);

    // R15.3.2: touch the account as the LAST write (balance-affecting delete).
    await touchAccount(accountRepo, workspaceId, abono.accountId, tx);

    return new Payable(
      {
        id: payable.id,
        workspaceId: payable.workspaceId,
        counterparty: payable.counterparty,
        total: payable.total,
        initialPayment: payable.initialPayment,
        accountId: payable.accountId,
        date: payable.date,
        dueDate: payable.dueDate,
        note: payable.note,
        createdAt: payable.createdAt,
        version: payable.version + 1,
      },
      payable.abonos.filter(a => a.id !== abonoId),
    );
  });
}