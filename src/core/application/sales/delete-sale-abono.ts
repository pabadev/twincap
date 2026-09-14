import { Sale } from '../../domain/sale';
import { NotFoundError } from '../../domain/errors';
import type { SaleRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { touchAccount } from '../financial/touch-accounts';

/**
 * LEGACY FALLBACK — delete an embedded abono from an on-credit sale (POS-6).
 *
 * Since R5-D0 the on-credit sale auto-creates the linked CreditGranted whose
 * principal covers the FULL sale total; the debt lives in the credit and its
 * abonos flow through credits-granted/delete-abono (sale-born branch). This
 * file only serves sales created before that rule (no linked credit) — the UI
 * hides the button once a linked credit exists, so this path is unreachable
 * for new data.
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
 * transaction (shared-document conflict point, R15.1-6e).
 */
export async function deleteSaleAbono(
  workspaceId: string,
  saleId: string,
  abonoId: string,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Sale> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const sales = await saleRepo.findByWorkspaceId(workspaceId, tx);
    const sale = sales.find(s => s.id === saleId);
    if (!sale) throw new NotFoundError('Sale not found');

    const abono = sale.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // R5-B: reverse the linked movement FIRST, then pull the abono. Deleting
    // the movement first means a mid-way failure leaves the abono intact (no
    // balance inflation). Tolerant: an already-missing movement is fine.
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

    // POS-6: remove abono (atomic $pull)
    await saleRepo.deleteAbono(workspaceId, saleId, abonoId, tx, sale.version);

    // R15.3.2: touch the account as the LAST write (balance-affecting delete).
    await touchAccount(accountRepo, workspaceId, abono.accountId, tx);

    return new Sale(
      {
        id: sale.id,
        workspaceId: sale.workspaceId,
        items: sale.items.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice })),
        date: sale.date,
        paymentMode: sale.paymentMode,
        accountId: sale.accountId,
        clientId: sale.clientId,
        deletedAt: sale.deletedAt,
        stockRestored: sale.stockRestored,
        createdAt: sale.createdAt,
        version: sale.version + 1,
      },
      sale.abonos.filter(a => a.id !== abonoId),
    );
  });
}