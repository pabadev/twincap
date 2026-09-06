import { Types } from "mongoose";
import type { CatalogItemDocument } from "../models/catalog";
import {
  CatalogItem,
  type CatalogItemType,
} from "../../core/domain/catalog";
import { isCurrency } from "../../core/domain/currency";
import { Money, MoneyError } from "../../core/domain/money";

/**
 * Convert a Mongoose CatalogItemDocument to a domain CatalogItem entity.
 *
 * The doc stores unitPrice as a raw number (minor units) plus the currency
 * persisted at creation time (items are currency-immutable, POS-1).
 */
export function toCatalogItemEntity(doc: CatalogItemDocument): CatalogItem {
  // Legacy pre-R14 docs may lack the currency field even though the schema type
  // declares it required (Mongoose does not validate on read).
  const currency = doc.currency as string | undefined;
  if (currency === undefined || !isCurrency(currency)) {
    // Legacy pre-R14 items have no persisted currency (the old repo derived it
    // from an arbitrary account). Failing loudly is safer than silently
    // relabeling the amount; R14-Fase O owns the backfill that adds currency.
    throw new MoneyError(
      `Catalog item ${doc._id.toString()} has no persisted currency; backfill required (R14-Fase O)`,
    );
  }
  return new CatalogItem({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    unitPrice: new Money(doc.unitPrice, currency),
    type: doc.type as CatalogItemType,
    stock: doc.stock,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain CatalogItem entity to plain data for Mongoose writes. */
export function toCatalogItemDocData(
  entity: CatalogItem,
): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    name: entity.name,
    unitPrice: entity.unitPrice.amount,
    currency: entity.unitPrice.currency,
    type: entity.type,
    stock: entity.stock,
  };
}
