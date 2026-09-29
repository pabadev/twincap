import type { Currency } from "../../../domain/currency";
import type { CatalogItemType, ProductRole } from "../../../domain/catalog";
import type { InventoryUnit } from "../../../domain/inventory-units";

export interface CreateCatalogItemInput {
  name: string;
  unitPrice: number; // minor units, > 0
  currency: Currency;
  type: CatalogItemType;
  productRole?: ProductRole;
  /** Required for products; stock input is entered in this unit. */
  saleUnit?: InventoryUnit;
  /** Initial stock entered in saleUnit. Must NOT be present for services. */
  stock?: number;
}

export interface EditCatalogItemInput {
  name?: string;
  unitPrice?: number; // minor units, > 0
  currency?: Currency;
  /** Product's display and sale unit. Its physical dimension is immutable. */
  saleUnit?: InventoryUnit;
  productRole?: ProductRole;
}
