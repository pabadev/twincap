import { ValidationError } from "./errors";
import { Money, assertSafeMinorUnits } from "./money";
import {
  calculateQuantitySubtotal,
  getUnitFactorToBase,
  quantityToBaseUnits,
  type InventoryUnit,
} from "./inventory-units";

/** POS-2: payment mode for a sale. */
export const PAYMENT_MODES = ["paid-in-full", "on-credit"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export function isPaymentMode(value: string): value is PaymentMode {
  return (PAYMENT_MODES as readonly string[]).includes(value);
}

/** A single line item inside a sale. */
export interface SaleLineItem {
  /** Reference to a CatalogItem. */
  itemId: string;
  /** Quantity in the sale unit, snapshotted for display. */
  quantity: number;
  /** Unit snapshot, defaults to discrete item for legacy sales. */
  unit: InventoryUnit;
  /** Integer stock atoms consumed, captured for exact sale reversal. */
  stockQuantity: number;
  /** Unit price snapshot at the time of the sale (POS-7: may change independently). */
  unitPrice: Money;
  /** Computed from stock atoms and the sale unit's conversion factor. */
  readonly subtotal: number;
  /** Immutable formula and actual consumption used for this sale line, if prepared on demand. */
  readonly formulaSnapshot?: {
    version: number;
    outputQuantity: number;
    outputUnit: InventoryUnit;
    components: Array<{ itemId: string; name: string; unit: InventoryUnit; stockQuantity: number }>;
  };
  readonly comboSnapshot?: {
    version: number;
    components: Array<{ itemId: string; name: string; unit: InventoryUnit; stockQuantity: number }>;
  };
}

/** Computed subtotal for a line item in minor units. */
export function computeLineItemSubtotal(
  quantity: number,
  unitPrice: Money,
  unit: InventoryUnit = "unit",
): number {
  // R15.3 §18: quantity × unitPrice can overflow the safe-integer range
  // before the subtotal re-enters Money — fail fast here.
  return calculateQuantitySubtotal(quantityToBaseUnits(quantity, unit), unit, unitPrice.amount);
}

/** Embedded abono for a sale (POS-4/5). */
export interface SaleAbono {
  id: string;
  amount: Money;
  date: Date;
  /** The account this abono was paid into. */
  accountId: string;
  /** Link to the movement created for this abono. */
  movementId?: string;
}

export interface SaleInput {
  id: string;
  workspaceId: string;
  items: SaleLineItemInput[];
  date: Date;
  paymentMode: PaymentMode;
  /** Account used for paid-in-full payment or abonos. */
  accountId: string;
  /** Optional client reference. "Cliente general" = undefined. */
  clientId?: string;
  /** Soft-delete timestamp (POS soft-delete). */
  deletedAt?: Date;
  /** Whether stock was restored after soft-delete. */
  stockRestored?: boolean;
  createdAt: Date;
  /**
   * Optimistic-concurrency version (mirrors the document's `__v`, default 0).
   * Applied via CAS on versioned writes and bumped on each successful write.
   */
  version?: number;
}

/** Input for a line item — subtotal is computed, not provided. */
export interface SaleLineItemInput {
  itemId: string;
  /** Quantity in the catalog item's sale unit. */
  quantity: number;
  unit?: InventoryUnit;
  stockQuantity?: number;
  unitPrice: Money;
  formulaSnapshot?: SaleLineItem["formulaSnapshot"];
  comboSnapshot?: SaleLineItem["comboSnapshot"];
}

export interface SaleAbonoInput {
  id: string;
  amount: Money;
  date: Date;
  accountId: string;
  movementId?: string;
}

export class Sale {
  readonly id: string;
  readonly workspaceId: string;
  readonly items: readonly Readonly<SaleLineItem>[];
  readonly date: Date;
  readonly paymentMode: PaymentMode;
  readonly accountId: string;
  readonly clientId?: string;
  /** Computed total: Σ (quantity × unitPrice) across all line items. */
  readonly total: number;
  readonly deletedAt?: Date;
  readonly stockRestored: boolean;
  readonly createdAt: Date;
  /** Optimistic-concurrency version (`__v`), default 0. */
  readonly version: number;

  /** Embedded abonos (POS-5/6). */
  private readonly _abonos: ReadonlyArray<SaleAbonoInput>;

  /** Derived pending = total − Σ abonos (POS-5). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    assertSafeMinorUnits(abonoSum, "Sale abonos sum");
    const pending = this.total - abonoSum;
    assertSafeMinorUnits(pending, "Sale pending");
    return pending;
  }

  /** Read-only view of abonos. */
  get abonos(): ReadonlyArray<SaleAbonoInput> {
    return this._abonos;
  }

  constructor(input: SaleInput, abonos: SaleAbonoInput[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("Sale id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Sale workspaceId must not be empty");
    }
    if (input.accountId.length === 0) {
      throw new ValidationError("Sale accountId must not be empty");
    }
    if (!isPaymentMode(input.paymentMode)) {
      throw new ValidationError(`Unknown payment mode: ${String(input.paymentMode)}`);
    }
    // POS-2: at least one line item
    if (input.items.length === 0) {
      throw new ValidationError("Sale must have at least one line item");
    }

    // Build line items with computed subtotals
    const items: SaleLineItem[] = [];
    let total = 0;

    for (const raw of input.items) {
      if (raw.itemId.length === 0) {
        throw new ValidationError("Sale line item itemId must not be empty");
      }
      // Sale quantity is normalized to integer inventory atoms before money
      // is calculated; this avoids binary floating-point in stock and totals.
      const unit = raw.unit ?? "unit";
      const convertedQuantity = quantityToBaseUnits(raw.quantity, unit);
      const stockQuantity = raw.stockQuantity ?? convertedQuantity;
      if (!Number.isSafeInteger(stockQuantity) || stockQuantity <= 0) {
        throw new ValidationError(
          `Sale line item base quantity must be a positive integer, got ${stockQuantity}`,
        );
      }
      if (stockQuantity !== convertedQuantity) {
        throw new ValidationError("Sale quantity does not match its base stock quantity");
      }
      if (raw.unitPrice.amount <= 0) {
        throw new ValidationError("Sale line item unitPrice must be positive");
      }
      if (raw.formulaSnapshot) {
        const snapshot = raw.formulaSnapshot;
        if (
          !Number.isSafeInteger(snapshot.version) ||
          snapshot.version < 1 ||
          snapshot.outputUnit !== unit ||
          quantityToBaseUnits(snapshot.outputQuantity, snapshot.outputUnit) !== convertedQuantity ||
          snapshot.components.length === 0
        ) {
          throw new ValidationError("Sale formula snapshot is invalid");
        }
        const componentIds = new Set<string>();
        for (const component of snapshot.components) {
          if (
            !component.itemId ||
            !component.name.trim() ||
            !Number.isSafeInteger(component.stockQuantity) ||
            component.stockQuantity <= 0 ||
            componentIds.has(component.itemId)
          ) {
            throw new ValidationError("Sale formula component snapshot is invalid");
          }
          getUnitFactorToBase(component.unit);
          componentIds.add(component.itemId);
        }
      }
      if (raw.comboSnapshot) {
        const snapshot = raw.comboSnapshot;
        if (
          !Number.isSafeInteger(snapshot.version) ||
          snapshot.version < 1 ||
          unit !== "unit" ||
          !Number.isInteger(raw.quantity) ||
          snapshot.components.length === 0
        ) {
          throw new ValidationError("Sale combo snapshot is invalid");
        }
        const componentIds = new Set<string>();
        for (const component of snapshot.components) {
          if (
            !component.itemId ||
            !component.name.trim() ||
            !Number.isSafeInteger(component.stockQuantity) ||
            component.stockQuantity <= 0 ||
            componentIds.has(component.itemId)
          ) {
            throw new ValidationError("Sale combo component snapshot is invalid");
          }
          getUnitFactorToBase(component.unit);
          componentIds.add(component.itemId);
        }
      }
      if (raw.comboSnapshot && raw.formulaSnapshot) {
        throw new ValidationError("A sale line cannot be both a combo and prepared formula");
      }
      const subtotal = calculateQuantitySubtotal(stockQuantity, unit, raw.unitPrice.amount);
      items.push({
        itemId: raw.itemId,
        quantity: stockQuantity / getUnitFactorToBase(unit),
        unit,
        stockQuantity,
        unitPrice: raw.unitPrice,
        formulaSnapshot: raw.formulaSnapshot
          ? {
              version: raw.formulaSnapshot.version,
              outputQuantity: raw.formulaSnapshot.outputQuantity,
              outputUnit: raw.formulaSnapshot.outputUnit,
              components: raw.formulaSnapshot.components.map((component) => ({ ...component })),
            }
          : undefined,
        comboSnapshot: raw.comboSnapshot
          ? {
              version: raw.comboSnapshot.version,
              components: raw.comboSnapshot.components.map((component) => ({ ...component })),
            }
          : undefined,
        subtotal,
      });
      total += subtotal;
      // R15.3 §18: the running sale total must stay a safe integer at every
      // step (fail fast before the total feeds Money/overpayment guards).
      assertSafeMinorUnits(total, "Sale constructor total");
    }

    // POS-5: validate abonos don't overpay
    const abonoSum = abonos.reduce((sum, a) => {
      if (a.amount.amount <= 0) {
        throw new ValidationError("Sale abono amount must be positive");
      }
      return sum + a.amount.amount;
    }, 0);
    assertSafeMinorUnits(abonoSum, "Sale constructor abonos sum");
    if (abonoSum > total) {
      throw new ValidationError("Sale abonos exceed total (overpayment rejected)");
    }

    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.items = items;
    this.date = input.date;
    this.paymentMode = input.paymentMode;
    this.accountId = input.accountId;
    this.clientId = input.clientId;
    this.total = total;
    this.deletedAt = input.deletedAt;
    this.stockRestored = input.stockRestored ?? false;
    this.createdAt = input.createdAt;
    this.version = input.version ?? 0;
    this._abonos = abonos;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      items: this.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toJSON(),
        formulaSnapshot: item.formulaSnapshot
          ? {
              ...item.formulaSnapshot,
              components: item.formulaSnapshot.components.map((c) => ({ ...c })),
            }
          : undefined,
        comboSnapshot: item.comboSnapshot
          ? {
              ...item.comboSnapshot,
              components: item.comboSnapshot.components.map((component) => ({ ...component })),
            }
          : undefined,
      })),
      date: this.date,
      paymentMode: this.paymentMode,
      accountId: this.accountId,
      clientId: this.clientId,
      total: this.total,
      deletedAt: this.deletedAt,
      stockRestored: this.stockRestored,
      createdAt: this.createdAt,
      version: this.version,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedSale = ReturnType<Sale["toJSON"]>;
