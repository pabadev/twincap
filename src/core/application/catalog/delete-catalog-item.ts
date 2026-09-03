import { ConflictError, NotFoundError } from '../../domain/errors';
import type { CatalogItemRepository, SaleRepository } from '../../domain/repositories';

/**
 * Delete a catalog item — POS-1.
 *
 * Guard: rejects deletion if any sale references this item.
 */
export async function deleteCatalogItem(
  workspaceId: string,
  itemId: string,
  catalogRepo: CatalogItemRepository,
  saleRepo: SaleRepository,
): Promise<void> {
  const existing = await catalogRepo.findById(workspaceId, itemId);
  if (!existing) throw new NotFoundError('Catalog item not found');

  const sales = await saleRepo.findByWorkspaceId(workspaceId);
  const referenced = sales.some(sale =>
    sale.items.some(item => item.itemId === itemId),
  );
  if (referenced) {
    throw new ConflictError('Cannot delete catalog item referenced by a sale');
  }

  await catalogRepo.delete(workspaceId, itemId);
}
