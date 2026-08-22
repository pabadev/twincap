import { ValidationError } from "./errors";
import { Money } from "./money";

/** POS-1: product has stock; service does not. */
export const CATALOG_ITEM_TYPES = ["product", "service"] as const;
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

export function isCatalogItemType(value: string): value is CatalogItemType {
  return (CATALOG_ITEM_TYPES as readonly string[]).includes(value);
}

export interface CatalogItemInput {
  id: string;
  userId: string;
  name: string;
  unitPrice: Money;
  type: CatalogItemType;
  /** Only valid for products (stock >= 0). Must NOT be present on services. */
  stock?: number;
  createdAt: Date;
}

export class CatalogItem {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly type: CatalogItemType;
  /** Present only for products; >= 0 (POS-3). */
  readonly stock: number | undefined;
  readonly createdAt: Date;

  constructor(input: CatalogItemInput) {
    if (input.id.length === 0) {
      throw new ValidationError("CatalogItem id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("CatalogItem userId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("CatalogItem name must not be empty");
    }
    if (input.unitPrice.amount <= 0) {
      throw new ValidationError("CatalogItem unitPrice must be positive");
    }
    if (!isCatalogItemType(input.type)) {
      throw new ValidationError(`Unknown CatalogItem type: ${String(input.type)}`);
    }

    if (input.type === "product") {
      // POS-1: product must have stock >= 0
      if (input.stock === undefined || input.stock < 0) {
        throw new ValidationError("Product must have stock >= 0");
      }
      this.stock = input.stock;
    } else {
      // POS-1: service must NOT have stock
      if (input.stock !== undefined) {
        throw new ValidationError("Service must not have stock");
      }
      this.stock = undefined;
    }

    this.id = input.id;
    this.userId = input.userId;
    this.name = name;
    this.unitPrice = input.unitPrice;
    this.type = input.type;
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      unitPrice: this.unitPrice.toJSON(),
      type: this.type,
      stock: this.stock,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCatalogItem = ReturnType<CatalogItem['toJSON']>;
