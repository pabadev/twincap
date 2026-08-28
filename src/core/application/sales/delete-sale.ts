import { NotFoundError } from '../../domain/errors';
import type {
  SaleRepository,
  CatalogItemRepository,
  MovementRepository,
  CreditGrantedRepository,
} from '../../domain/repositories';

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
 * `findByUserId` on movements nor a per-id delete loop.
 */
export async function deleteSale(
  userId: string,
  saleId: string,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
  creditRepo: CreditGrantedRepository,
): Promise<void> {
  const sales = await saleRepo.findByUserId(userId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  // POS-8: restore stock for physical items
  for (const item of sale.items) {
    const catalogItem = await catalogRepo.findById(userId, item.itemId);
    if (catalogItem && catalogItem.type === 'product') {
      await catalogRepo.incrementStock(userId, item.itemId, item.quantity);
    }
  }

  const credits = await creditRepo.findByUserId(userId);
  const linkedCredit = credits.find(c => c.saleId === saleId);

  // Robust format-agnostic cascade: delete every movement that references the
  // sale (legacy salePayment — ObjectId or UUID) and, if a linked credit
  // exists, every movement that references the credit (initial payment +
  // abonos). deleteMany is tolerant of already-missing movements (returns 0).
  await movementRepo.deleteByRefId(userId, saleId);
  if (linkedCredit) {
    await movementRepo.deleteByRefId(userId, linkedCredit.id);
  }

  if (linkedCredit) {
    await creditRepo.delete(userId, linkedCredit.id);
  }

  await saleRepo.delete(userId, saleId);
}