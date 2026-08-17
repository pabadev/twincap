import { Types } from "mongoose";
import type { SaleDocument } from "../models/sale";
import {
  Sale,
  type SaleLineItemInput,
  type SaleAbonoInput,
} from "../../core/domain/sale";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose SaleDocument to a domain Sale entity.
 *
 * The doc stores monetary amounts as raw numbers. The Currency must be
 * provided by the caller (the sale's account currency).
 */
export function toSaleEntity(
  doc: SaleDocument,
  currency: Currency,
): Sale {
  const items: SaleLineItemInput[] = doc.items.map((item) => ({
    itemId: item.itemId.toString(),
    quantity: item.quantity,
    unitPrice: new Money(item.unitPrice, currency),
  }));

  const abonos: SaleAbonoInput[] = doc.abonos.map((abono) => ({
    id: abono.id,
    amount: new Money(abono.amount, currency),
    date: abono.date,
    accountId: abono.accountId.toString(),
    movementId: abono.movementId,
  }));

  return new Sale(
    {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      items,
      date: doc.date,
      paymentMode: doc.paymentMode,
      accountId: doc.accountId.toString(),
      createdAt: doc.createdAt,
    },
    abonos,
  );
}

/** Convert a domain Sale entity to plain data for Mongoose writes. */
export function toSaleDocData(entity: Sale): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(entity.id),
    userId: new Types.ObjectId(entity.userId),
    items: entity.items.map((item) => ({
      itemId: new Types.ObjectId(item.itemId),
      quantity: item.quantity,
      unitPrice: item.unitPrice.amount,
      subtotal: item.subtotal,
    })),
    date: entity.date,
    paymentMode: entity.paymentMode,
    accountId: new Types.ObjectId(entity.accountId),
    total: entity.total,
    abonos: entity.abonos.map((abono) => ({
      id: abono.id,
      amount: abono.amount.amount,
      date: abono.date,
      accountId: new Types.ObjectId(abono.accountId),
      movementId: abono.movementId,
    })),
    deletedAt: undefined,
    stockRestored: false,
  };
}
