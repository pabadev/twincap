import { Types } from "mongoose";
import type { CatalogItemDocument } from "../models/catalog";
import {
  CatalogItem,
  type CatalogItemType,
} from "../../core/domain/catalog";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose CatalogItemDocument to a domain CatalogItem entity.
 *
 * The doc stores unitPrice as a raw number (minor units). The Currency
 * must be provided by the caller (typically the user's default or the
 * sale's account currency).
 */
export function toCatalogItemEntity(
  doc: CatalogItemDocument,
  currency: Currency,
): CatalogItem {
  return new CatalogItem({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
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
    _id: new Types.ObjectId(entity.id),
    userId: new Types.ObjectId(entity.userId),
    name: entity.name,
    unitPrice: entity.unitPrice.amount,
    type: entity.type,
    stock: entity.stock,
  };
}
