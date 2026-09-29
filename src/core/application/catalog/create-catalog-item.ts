import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { IdGenerator } from "../ports";
import type { CreateCatalogItemInput } from "./dto/catalog";
import { quantityToBaseUnits } from "../../domain/inventory-units";
import type { TransactionHandle } from "../../domain/transaction";

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
  tx?: TransactionHandle,
  actorUserId?: string,
): Promise<CatalogItem> {
  const id = ids.generate();
  const productRole = input.type === "product" ? (input.productRole ?? "sellable") : "sellable";
  const unitPrice =
    productRole === "supply"
      ? Money.nonNegative(input.unitPrice, input.currency)
      : new Money(input.unitPrice, input.currency);
  const now = new Date();
  const saleUnit = input.type === "product" ? (input.saleUnit ?? "unit") : "unit";
  const stock =
    input.type === "product" && input.stock !== undefined
      ? quantityToBaseUnits(input.stock, saleUnit, true)
      : undefined;

  const item = new CatalogItem({
    id,
    workspaceId,
    name: input.name,
    unitPrice,
    type: input.type,
    productRole: input.productRole,
    stock,
    saleUnit,
    createdAt: now,
  });

  return catalogRepo.create(item, tx, actorUserId);
}
