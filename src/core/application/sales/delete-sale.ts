import { NotFoundError } from '../../domain/errors';
import type {
  SaleRepository,
  CatalogItemRepository,
  MovementRepository,
  CreditGrantedRepository,
} from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

/**
 * Delete a sale and cascade (POS-8, R5-D0c).
 *
 * Restore stock for physical items. Then delete ALL movements that reference
 * this sale by refId via `deleteByRefId` (covers both current ObjectId
 * refIds and legacy UUID refIds format-agnostically) plus, when a linked
 * CreditGranted exists (sale-born credit), all movements that reference that
 * credit by refId — initial payment + abonos (creditGrantedAbono/Principal).
 * The linked credit is deleted too, so no orphan credit keeps feeding the
 * dashboard.
 *
 * Movement deletion is tolerant by construction: `deleteByRefId` is a
 * `deleteMany`, which never throws for "not found" (it reports 0 deleted).
 * Any non-NotFound repo error still propagates naturally. Because we delete
 * by refId instead of by pre-listed movement ids, we no longer need
 * `findByWorkspaceId` on movements nor a per-id delete loop.
 *
 * R15 Fase 6 — transactional + idempotent (auditoría §9):
 * The WHOLE cascade (read sale snapshot, per-item stock read, stock restores,
 * movement deletes, credit delete, sale delete) runs inside
 * `uow.withTransaction(...)`. All reads and writes join the transaction
 * session, so either the entire cascade commits or it rolls back atomically — a
 * mid-way failure can no longer leave stock restored while the sale survives.
 *
 * Idempotency under CONCURRENT/duplicate requests is guaranteed by the
 * transaction PLUS the `saleRepo.delete` NotFound: the sale is read inside the
 * transaction (snapshot), and `delete` is the final write. If a second request
 * races the first, its transaction re-executes after the winner commits and
 * `findByWorkspaceId(saleId)` inside it no longer finds the sale → NotFoundError
 * → clean abort, so stock is restored EXACTLY once (the winner's transaction).
 */
export async function deleteSale(
  workspaceId: string,
  saleId: string,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
  creditRepo: CreditGrantedRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const sales = await saleRepo.findByWorkspaceId(workspaceId, tx);
    const sale = sales.find(s => s.id === saleId);
    if (!sale) throw new NotFoundError('Sale not found');

    // POS-8: restore stock for physical items (read the item INSIDE the tx so
    // the restore is snapshot-consistent with the sale snapshot).
    for (const item of sale.items) {
      const catalogItem = await catalogRepo.findById(workspaceId, item.itemId, tx);
      if (catalogItem && catalogItem.type === 'product') {
        await catalogRepo.incrementStock(workspaceId, item.itemId, item.quantity, tx);
      }
    }

    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const linkedCredit = credits.find(c => c.saleId === saleId);

    // Robust format-agnostic cascade: delete every movement that references the
    // sale (legacy salePayment — ObjectId or UUID) and, if a linked credit
    // exists, every movement that references the credit (initial payment +
    // abonos). deleteMany is tolerant of already-missing movements (returns 0).
    await movementRepo.deleteByRefId(workspaceId, saleId, tx);
    if (linkedCredit) {
      await movementRepo.deleteByRefId(workspaceId, linkedCredit.id, tx);
    }

    if (linkedCredit) {
      await creditRepo.delete(workspaceId, linkedCredit.id, tx);
    }

    // Final write. If the sale was deleted by a concurrent request, this
    // throws NotFoundError and the whole transaction (including the stock
    // restore) rolls back — stock is never restored twice.
    await saleRepo.delete(workspaceId, saleId, tx);
  });
}