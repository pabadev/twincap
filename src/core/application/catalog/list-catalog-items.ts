import type { CatalogItem } from '../../domain/catalog';
import type { CatalogItemRepository } from '../../domain/repositories';

/**
 * List all catalog items for a user — POS-1.
 */
export async function listCatalogItems(
  userId: string,
  catalogRepo: CatalogItemRepository,
): Promise<CatalogItem[]> {
  return catalogRepo.findByUserId(userId);
}
