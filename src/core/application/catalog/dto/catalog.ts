import type { Currency } from '../../../domain/currency';
import type { CatalogItemType } from '../../../domain/catalog';

export interface CreateCatalogItemInput {
  name: string;
  unitPrice: number; // minor units, > 0
  currency: Currency;
  type: CatalogItemType;
  /** Required for products (integer stock >= 0). Must NOT be present for services. */
  stock?: number;
}

export interface EditCatalogItemInput {
  name?: string;
  unitPrice?: number; // minor units, > 0
  currency?: Currency;
  /** Only for products: stock adjustment (integer >= 0). Type is immutable. */
  stock?: number;
}
