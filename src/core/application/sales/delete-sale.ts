import { NotFoundError } from '../../domain/errors';
import type { SaleRepository, CatalogItemRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete a sale and cascade (POS-8).
 *
 * Restore stock for physical items. Reverse ALL abono movements.
 * Reverse payment movements for paid-in-full sales.
 * Uses soft-delete with stockRestored marker (design §5).
 */
export async function deleteSale(
  userId: string,
  saleId: string,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
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

  // POS-8: reverse ALL movements linked to this sale (abonos + payment)
  const movements = await movementRepo.findByUserId(userId);
  const linkedMovements = movements.filter(m => m.link?.refId === saleId);
  for (const m of linkedMovements) {
    await movementRepo.delete(userId, m.id);
  }

  await saleRepo.delete(userId, saleId);
}
