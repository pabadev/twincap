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
 * Restore stock for physical items. Reverse ALL movements owned by the linked
 * credit (initial payment + abonos, refId = creditId) plus any legacy
 * salePayment movements still referencing the sale itself (pre-R5-A model).
 * If a linked CreditGranted exists (sale-born credit), it is deleted too, so
 * no orphan credit keeps feeding the dashboard.
 *
 * Movement deletion is tolerant: movements listed by findByUserId may already
 * be gone by the time delete runs (no multi-doc transactions on Atlas shared
 * tier) — a NotFoundError there just means nothing to clean, NOT a failure
 * that should surface a false error toast.
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

  const [movements, credits] = await Promise.all([
    movementRepo.findByUserId(userId),
    creditRepo.findByUserId(userId),
  ]);
  const linkedCredit = credits.find(c => c.saleId === saleId);

  // Collect movement ids before deleting: the credit's movements (NEW model,
  // initial payment + abonos) plus legacy movements that referenced the sale
  // directly (OLD model salePayments).
  const movementIdsToDelete = new Set<string>();
  for (const m of movements) {
    if (linkedCredit && m.link?.refId === linkedCredit.id) {
      movementIdsToDelete.add(m.id);
    }
    if (m.link?.refId === saleId) {
      movementIdsToDelete.add(m.id);
    }
  }

  // Tolerant delete: an already-missing movement (concurrent removal) is fine
  // — it cannot be orphaned. Anything else must surface.
  for (const m of movements) {
    if (!movementIdsToDelete.has(m.id)) continue;
    try {
      await movementRepo.delete(userId, m.id);
    } catch (err) {
      if (err instanceof NotFoundError) continue;
      throw err;
    }
  }

  if (linkedCredit) {
    await creditRepo.delete(userId, linkedCredit.id);
  }

  await saleRepo.delete(userId, saleId);
}