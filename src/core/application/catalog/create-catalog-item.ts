import { CatalogItem } from '../../domain/catalog';
import { Money } from '../../domain/money';
import type { CatalogItemRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateCatalogItemInput } from './dto/catalog';

/**
 * Create a catalog item: product (with stock) or service (no stock) — POS-1.
 *
 * Domain constructor validates type/stock rules. This use case handles
 * id generation and repository persistence.
 */
export async function createCatalogItem(
  workspaceId: string,
  input: CreateCatalogItemInput,
  catalogRepo: CatalogItemRepository,
  ids: IdGenerator,
): Promise<CatalogItem> {
  const id = ids.generate();
  const unitPrice = new Money(input.unitPrice, input.currency);
  const now = new Date();

  const item = new CatalogItem({
    id,
    workspaceId,
    name: input.name,
    unitPrice,
    type: input.type,
    stock: input.stock,
    createdAt: now,
  });

  return catalogRepo.create(item);
}
