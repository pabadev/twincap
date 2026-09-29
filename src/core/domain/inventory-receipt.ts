import { ValidationError } from "./errors";
import { Money, sumSafeMinorUnits } from "./money";
import { quantityToBaseUnits, type InventoryUnit } from "./inventory-units";
import type { Currency } from "./currency";

export interface InventoryReceiptLineInput {
  catalogItemId: string;
  quantity: number;
  unit: InventoryUnit;
  stockQuantity: number;
  /** Allocated purchase amount in currency minor units. */
  lineAmount: number;
}

export interface InventoryReceiptInput {
  id: string;
  workspaceId: string;
  lines: InventoryReceiptLineInput[];
  currency: Currency;
  supplierName?: string;
  reference?: string;
  date: Date;
  accountId: string;
  initialPayment: number;
  payableId?: string;
  actorUserId: string;
  createdAt: Date;
}

/** Immutable record of received supplies and its optional outstanding payable. */
export class InventoryReceipt {
  readonly id: string;
  readonly workspaceId: string;
  readonly lines: readonly Readonly<InventoryReceiptLineInput>[];
  readonly total: Money;
  readonly initialPayment: number;
  readonly supplierName?: string;
  readonly reference?: string;
  readonly date: Date;
  readonly accountId: string;
  readonly payableId?: string;
  readonly actorUserId: string;
  readonly createdAt: Date;

  constructor(input: InventoryReceiptInput) {
    if (!input.id || !input.workspaceId || !input.accountId || !input.actorUserId) {
      throw new ValidationError("Inventory receipt identifiers are required");
    }
    if (input.lines.length === 0)
      throw new ValidationError("Inventory receipt requires at least one line");
    if (Number.isNaN(input.date.getTime()))
      throw new ValidationError("Inventory receipt date is invalid");
    if (
      (input.supplierName?.trim().length ?? 0) > 120 ||
      (input.reference?.trim().length ?? 0) > 120
    ) {
      throw new ValidationError("Supplier and reference must not exceed 120 characters");
    }

    for (const line of input.lines) {
      if (!line.catalogItemId) throw new ValidationError("Inventory receipt item is required");
      if (!Number.isSafeInteger(line.stockQuantity) || line.stockQuantity <= 0) {
        throw new ValidationError("Received stock quantity must be a positive safe integer");
      }
      if (quantityToBaseUnits(line.quantity, line.unit) !== line.stockQuantity) {
        throw new ValidationError("Received quantity does not match its base stock amount");
      }
      if (!Number.isSafeInteger(line.lineAmount) || line.lineAmount < 0) {
        throw new ValidationError("Receipt line amount must be a non-negative minor-unit integer");
      }
    }

    const total = sumSafeMinorUnits(
      input.lines.map((line) => line.lineAmount),
      "Inventory receipt total",
    );
    if (total <= 0) throw new ValidationError("Inventory receipt total must be positive");
    if (
      !Number.isSafeInteger(input.initialPayment) ||
      input.initialPayment < 0 ||
      input.initialPayment > total
    ) {
      throw new ValidationError("Initial payment must be between zero and receipt total");
    }

    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.lines = input.lines.map((line) => Object.freeze({ ...line }));
    this.total = new Money(total, input.currency);
    this.initialPayment = input.initialPayment;
    this.supplierName = input.supplierName?.trim() || undefined;
    this.reference = input.reference?.trim() || undefined;
    this.date = input.date;
    this.accountId = input.accountId;
    this.payableId = input.payableId;
    this.actorUserId = input.actorUserId;
    this.createdAt = input.createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      lines: this.lines.map((line) => ({ ...line })),
      total: this.total.toJSON(),
      initialPayment: this.initialPayment,
      supplierName: this.supplierName,
      reference: this.reference,
      date: this.date,
      accountId: this.accountId,
      payableId: this.payableId,
      actorUserId: this.actorUserId,
      createdAt: this.createdAt,
    };
  }
}

export type SerializedInventoryReceipt = ReturnType<InventoryReceipt["toJSON"]>;
