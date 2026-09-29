import { Types } from "mongoose";
import { InventoryReceipt } from "../../core/domain/inventory-receipt";
import type { InventoryReceiptDocument } from "../models/inventory-receipt";
import type { Currency } from "../../core/domain/currency";
import type { InventoryUnit } from "../../core/domain/inventory-units";

export function toInventoryReceiptEntity(doc: InventoryReceiptDocument): InventoryReceipt {
  return new InventoryReceipt({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    lines: doc.lines.map((line) => ({
      catalogItemId: line.catalogItemId.toString(),
      quantity: line.quantity,
      unit: line.unit as InventoryUnit,
      stockQuantity: line.stockQuantity,
      lineAmount: line.lineAmount,
    })),
    currency: doc.currency as Currency,
    initialPayment: doc.initialPayment,
    supplierName: doc.supplierName,
    reference: doc.reference,
    date: doc.date,
    accountId: doc.accountId.toString(),
    payableId: doc.payableId?.toString(),
    actorUserId: doc.actorUserId,
    createdAt: doc.createdAt,
  });
}

export function toInventoryReceiptDocData(receipt: InventoryReceipt): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(receipt.id),
    workspaceId: new Types.ObjectId(receipt.workspaceId),
    lines: receipt.lines.map((line) => ({
      catalogItemId: new Types.ObjectId(line.catalogItemId),
      quantity: line.quantity,
      unit: line.unit,
      stockQuantity: line.stockQuantity,
      lineAmount: line.lineAmount,
    })),
    total: receipt.total.amount,
    currency: receipt.total.currency,
    initialPayment: receipt.initialPayment,
    supplierName: receipt.supplierName,
    reference: receipt.reference,
    date: receipt.date,
    accountId: new Types.ObjectId(receipt.accountId),
    ...(receipt.payableId ? { payableId: new Types.ObjectId(receipt.payableId) } : {}),
    actorUserId: receipt.actorUserId,
  };
}
