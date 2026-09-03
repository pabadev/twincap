import { CatalogItem } from '../../domain/catalog';
import { Money } from '../../domain/money';
import { NotFoundError } from '../../domain/errors';
import type { CatalogItemRepository } from '../../domain/repositories';
import type { EditCatalogItemInput } from './dto/catalog';

/**
 * Update a catalog item — POS-1.
 *
 * Allowed edits: name, unitPrice, stock (products only).
 * Type is immutable — cannot change product ↔ service.
 */
export async function updateCatalogItem(
  workspaceId: string,
  itemId: string,
  input: EditCatalogItemInput,
  catalogRepo: CatalogItemRepository,
): Promise<CatalogItem> {
  const existing = await catalogRepo.findById(workspaceId, itemId);
  if (!existing) throw new NotFoundError('Catalog item not found');

  const updated = new CatalogItem({
    id: existing.id,
    workspaceId: existing.workspaceId,
    name: input.name ?? existing.name,
    unitPrice: input.unitPrice != null && input.currency != null
      ? new Money(input.unitPrice, input.currency)
      : input.unitPrice != null
        ? new Money(input.unitPrice, existing.unitPrice.currency)
        : existing.unitPrice,
    type: existing.type, // immutable
    stock: existing.type === 'product'
      ? (input.stock ?? existing.stock)
      : undefined,
    createdAt: existing.createdAt,
  });

  return catalogRepo.update(updated);
}
