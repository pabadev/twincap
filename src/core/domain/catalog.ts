import { ValidationError } from "./errors";
import { Money } from "./money";
import { getBaseUnit, isInventoryUnit, type InventoryUnit } from "./inventory-units";
import type { ProductFormulaVersion } from "./product-formula";
import type { ProductComboVersion } from "./product-combo";

/** POS-1: product has stock; service does not. */
export const CATALOG_ITEM_TYPES = ["product", "service"] as const;
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];
export const PRODUCT_ROLES = ["sellable", "supply", "both"] as const;
export type ProductRole = (typeof PRODUCT_ROLES)[number];

export function isCatalogItemType(value: string): value is CatalogItemType {
  return (CATALOG_ITEM_TYPES as readonly string[]).includes(value);
}

export interface CatalogItemInput {
  id: string;
  workspaceId: string;
  name: string;
  unitPrice: Money;
  type: CatalogItemType;
  productRole?: ProductRole;
  formulaVersions?: ProductFormulaVersion[];
  comboVersions?: ProductComboVersion[];
  /** Price and POS quantity unit; stock is stored as integer base atoms. */
  saleUnit?: InventoryUnit;
  /** Only valid for products (integer stock >= 0). Must NOT be present on services. */
  stock?: number;
  createdAt: Date;
}

export class CatalogItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly type: CatalogItemType;
  readonly productRole: ProductRole;
  readonly formulaVersions: readonly ProductFormulaVersion[];
  readonly comboVersions: readonly ProductComboVersion[];
  readonly saleUnit: InventoryUnit;
  /** Present only for products; integer >= 0 (POS-3, R15.3.1 P3). */
  readonly stock: number | undefined;
  readonly createdAt: Date;

  constructor(input: CatalogItemInput) {
    if (input.id.length === 0) {
      throw new ValidationError("CatalogItem id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("CatalogItem workspaceId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("CatalogItem name must not be empty");
    }
    if (!isCatalogItemType(input.type)) {
      throw new ValidationError(`Unknown CatalogItem type: ${String(input.type)}`);
    }
    if (
      input.productRole !== undefined &&
      !(PRODUCT_ROLES as readonly string[]).includes(input.productRole)
    ) {
      throw new ValidationError(`Unknown product role: ${String(input.productRole)}`);
    }
    const productRole = input.type === "service" ? "sellable" : (input.productRole ?? "sellable");
    if (input.unitPrice.amount < 0 || (productRole !== "supply" && input.unitPrice.amount === 0)) {
      throw new ValidationError("CatalogItem unitPrice must be positive unless it is supply-only");
    }
    const saleUnit = input.saleUnit ?? "unit";
    if (!isInventoryUnit(saleUnit)) {
      throw new ValidationError(`Unknown inventory unit: ${String(saleUnit)}`);
    }

    if (input.type === "product") {
      // Inventory stock is stored as non-negative integer atoms; the sale unit
      // controls how those atoms are displayed and consumed in the POS.
      if (input.stock === undefined || !Number.isSafeInteger(input.stock) || input.stock < 0) {
        throw new ValidationError("Product stock must be a non-negative safe integer");
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
    this.workspaceId = input.workspaceId;
    this.name = name;
    this.unitPrice = input.unitPrice;
    this.type = input.type;
    this.productRole = productRole;
    const formulas = input.formulaVersions ?? [];
    if (formulas.some((formula, index) => formula.version !== index + 1)) {
      throw new ValidationError("Product formula versions must be sequential and immutable");
    }
    if (formulas.length > 0 && (input.type !== "product" || productRole === "supply")) {
      throw new ValidationError("Only sellable products can have a formula");
    }
    this.formulaVersions = formulas;
    const combos = input.comboVersions ?? [];
    if (combos.some((combo, index) => combo.version !== index + 1)) {
      throw new ValidationError("Product combo versions must be sequential and immutable");
    }
    if (
      combos.length > 0 &&
      (input.type !== "product" ||
        productRole !== "sellable" ||
        saleUnit !== "unit" ||
        input.stock !== 0)
    ) {
      throw new ValidationError(
        "Combos must be discrete sellable products without independent stock",
      );
    }
    if (combos.length > 0 && formulas.length > 0) {
      throw new ValidationError("A product cannot be both a prepared formula and a combo");
    }
    this.comboVersions = combos;
    this.saleUnit = input.type === "service" ? "unit" : saleUnit;
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      unitPrice: this.unitPrice.toJSON(),
      type: this.type,
      productRole: this.productRole,
      formulaVersions: this.formulaVersions.map((formula) => ({
        ...formula,
        components: formula.components.map((component) => ({ ...component })),
      })),
      comboVersions: this.comboVersions.map((combo) => ({
        ...combo,
        components: combo.components.map((component) => ({ ...component })),
      })),
      saleUnit: this.saleUnit,
      stock: this.stock,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCatalogItem = ReturnType<CatalogItem["toJSON"]>;
