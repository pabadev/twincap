import { Types } from "mongoose";
import type { CatalogItemDocument } from "../models/catalog";
import { CatalogItem, type CatalogItemType } from "../../core/domain/catalog";
import { isCurrency } from "../../core/domain/currency";
import { Money, MoneyError } from "../../core/domain/money";
import { isInventoryUnit, type InventoryUnit } from "../../core/domain/inventory-units";
import { createProductFormulaVersion } from "../../core/domain/product-formula";
import { createProductComboVersion } from "../../core/domain/product-combo";

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
  if (doc.saleUnit !== undefined && !isInventoryUnit(String(doc.saleUnit))) {
    throw new Error(`Catalog item ${doc._id.toString()} has an invalid sale unit`);
  }
  const saleUnit: InventoryUnit =
    doc.saleUnit === undefined ? "unit" : (doc.saleUnit as InventoryUnit);
  const productRole = doc.type === "product" ? (doc.productRole ?? "sellable") : "sellable";
  return new CatalogItem({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    unitPrice:
      productRole === "supply"
        ? Money.nonNegative(doc.unitPrice, currency)
        : new Money(doc.unitPrice, currency),
    type: doc.type as CatalogItemType,
    productRole,
    formulaVersions: (doc.formulaVersions ?? []).map((formula) =>
      createProductFormulaVersion({
        version: formula.version,
        yieldQuantity: formula.yieldQuantity,
        yieldUnit: formula.yieldUnit as InventoryUnit,
        components: formula.components.map((component) => ({
          itemId: component.itemId.toString(),
          name: component.name,
          quantity: component.quantity,
          unit: component.unit as InventoryUnit,
        })),
        createdAt: formula.createdAt,
      }),
    ),
    comboVersions: (doc.comboVersions ?? []).map((combo) =>
      createProductComboVersion({
        version: combo.version,
        components: combo.components.map((component) => ({
          itemId: component.itemId.toString(),
          name: component.name,
          quantity: component.quantity,
          unit: component.unit as InventoryUnit,
        })),
        createdAt: combo.createdAt,
      }),
    ),
    saleUnit,
    stock: doc.stock,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain CatalogItem entity to plain data for Mongoose writes. */
export function toCatalogItemDocData(entity: CatalogItem): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    name: entity.name,
    unitPrice: entity.unitPrice.amount,
    currency: entity.unitPrice.currency,
    type: entity.type,
    productRole: entity.productRole,
    formulaVersions: entity.formulaVersions.map((formula) => ({
      ...formula,
      components: formula.components.map((component) => ({
        ...component,
        itemId: new Types.ObjectId(component.itemId),
      })),
    })),
    comboVersions: entity.comboVersions.map((combo) => ({
      ...combo,
      components: combo.components.map((component) => ({
        ...component,
        itemId: new Types.ObjectId(component.itemId),
      })),
    })),
    saleUnit: entity.saleUnit,
    stock: entity.stock,
  };
}
