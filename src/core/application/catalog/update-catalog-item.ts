import { CatalogItem } from '../../domain/catalog';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { CatalogItemRepository } from '../../domain/repositories';
import type { EditCatalogItemInput } from './dto/catalog';

/**
 * Update a catalog item — POS-1.
 *
 * Allowed edits: name, unitPrice, stock (products only).
 * Type and currency are immutable — cannot change product ↔ service
 * or rewrite the unit price currency after creation.
 */
export async function updateCatalogItem(
  workspaceId: string,
  itemId: string,
  input: EditCatalogItemInput,
  catalogRepo: CatalogItemRepository,
): Promise<CatalogItem> {
  const existing = await catalogRepo.findById(workspaceId, itemId);
  if (!existing) throw new NotFoundError('Catalog item not found');

  // ACC-1/POS-1: the unit price currency is immutable.
  if (input.currency != null && input.currency !== existing.unitPrice.currency) {
    throw new ValidationError(`Catalog item currency is ${existing.unitPrice.currency}, declared ${input.currency}`);
  }

  const updated = new CatalogItem({
    id: existing.id,
    workspaceId: existing.workspaceId,
    name: input.name ?? existing.name,
    unitPrice: input.unitPrice != null
      ? new Money(input.unitPrice, input.currency ?? existing.unitPrice.currency)
      : existing.unitPrice,
    type: existing.type, // immutable
    stock: existing.type === 'product'
      ? (input.stock ?? existing.stock)
      : undefined,
    createdAt: existing.createdAt,
  });

  return catalogRepo.update(updated);
}
