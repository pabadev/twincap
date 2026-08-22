import { ValidationError } from "./errors";
import { Money } from "./money";

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
  quantity: number;
  /** Unit price snapshot at the time of the sale (POS-7: may change independently). */
  unitPrice: Money;
  /** Computed: quantity × unitPrice (minor units). */
  readonly subtotal: number;
}

/** Computed subtotal for a line item in minor units. */
export function computeLineItemSubtotal(quantity: number, unitPrice: Money): number {
  return quantity * unitPrice.amount;
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
  userId: string;
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
}

/** Input for a line item — subtotal is computed, not provided. */
export interface SaleLineItemInput {
  itemId: string;
  quantity: number;
  unitPrice: Money;
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
  readonly userId: string;
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

  /** Embedded abonos (POS-5/6). */
  private readonly _abonos: ReadonlyArray<SaleAbonoInput>;

  /** Derived pending = total − Σ abonos (POS-5). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.total - abonoSum;
  }

  /** Read-only view of abonos. */
  get abonos(): ReadonlyArray<SaleAbonoInput> {
    return this._abonos;
  }

  constructor(input: SaleInput, abonos: SaleAbonoInput[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("Sale id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Sale userId must not be empty");
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
      if (raw.quantity <= 0) {
        throw new ValidationError(`Sale line item quantity must be > 0, got ${raw.quantity}`);
      }
      if (raw.unitPrice.amount <= 0) {
        throw new ValidationError("Sale line item unitPrice must be positive");
      }
      const subtotal = computeLineItemSubtotal(raw.quantity, raw.unitPrice);
      items.push({
        itemId: raw.itemId,
        quantity: raw.quantity,
        unitPrice: raw.unitPrice,
        subtotal,
      });
      total += subtotal;
    }

    // POS-5: validate abonos don't overpay
    const abonoSum = abonos.reduce((sum, a) => {
      if (a.amount.amount <= 0) {
        throw new ValidationError("Sale abono amount must be positive");
      }
      return sum + a.amount.amount;
    }, 0);
    if (abonoSum > total) {
      throw new ValidationError("Sale abonos exceed total (overpayment rejected)");
    }

    this.id = input.id;
    this.userId = input.userId;
    this.items = items;
    this.date = input.date;
    this.paymentMode = input.paymentMode;
    this.accountId = input.accountId;
    this.clientId = input.clientId;
    this.total = total;
    this.deletedAt = input.deletedAt;
    this.stockRestored = input.stockRestored ?? false;
    this.createdAt = input.createdAt;
    this._abonos = abonos;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toJSON(),
      })),
      date: this.date,
      paymentMode: this.paymentMode,
      accountId: this.accountId,
      clientId: this.clientId,
      total: this.total,
      deletedAt: this.deletedAt,
      stockRestored: this.stockRestored,
      createdAt: this.createdAt,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedSale = ReturnType<Sale['toJSON']>;
