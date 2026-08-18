import { ConflictError, NotFoundError } from '../../domain/errors';
import type { CatalogItemRepository, SaleRepository } from '../../domain/repositories';

/**
 * Delete a catalog item — POS-1.
 *
 * Guard: rejects deletion if any sale references this item.
 */
export async function deleteCatalogItem(
  userId: string,
  itemId: string,
  catalogRepo: CatalogItemRepository,
  saleRepo: SaleRepository,
): Promise<void> {
  const existing = await catalogRepo.findById(userId, itemId);
  if (!existing) throw new NotFoundError('Catalog item not found');

  const sales = await saleRepo.findByUserId(userId);
  const referenced = sales.some(sale =>
    sale.items.some(item => item.itemId === itemId),
  );
  if (referenced) {
    throw new ConflictError('Cannot delete catalog item referenced by a sale');
  }

  await catalogRepo.delete(userId, itemId);
}
