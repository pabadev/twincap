import { Types } from "mongoose";
import type { PayableDocument } from "../models/payable";
import { Payable, type PayableAbono } from "../../core/domain/payable";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose PayableDocument to a domain Payable entity.
 *
 * The doc stores total, initialPayment and abono amounts as raw numbers. The
 * Currency must be provided by the caller (the payable's account currency).
 * total is always strictly positive in storage: the record keeps the purchase
 * TOTAL and pending is only derived — so the strict Money constructor is safe.
 */
export function toPayableEntity(
  doc: PayableDocument,
  currency: Currency,
): Payable {
  const abonos: PayableAbono[] = doc.abonos.map((a) => ({
    id: a.id,
    amount: new Money(a.amount, currency),
    date: a.date,
    accountId: a.accountId.toString(),
    movementId: a.movementId,
  }));

  return new Payable(
    {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      counterparty: doc.counterparty,
      total: new Money(doc.total, currency),
      initialPayment: doc.initialPayment,
      accountId: doc.accountId.toString(),
      date: doc.date,
      dueDate: doc.dueDate,
      note: doc.note,
      createdAt: doc.createdAt,
    },
    abonos,
  );
}

/** Convert a domain Payable entity to plain data for Mongoose writes. */
export function toPayableDocData(
  entity: Payable,
): Record<string, unknown> {
  return {
    userId: new Types.ObjectId(entity.userId),
    counterparty: entity.counterparty,
    total: entity.total.amount,
    initialPayment: entity.initialPayment,
    accountId: new Types.ObjectId(entity.accountId),
    date: entity.date,
    dueDate: entity.dueDate,
    note: entity.note,
    abonos: entity.abonos.map((a) => ({
      id: a.id,
      amount: a.amount.amount,
      date: a.date,
      accountId: new Types.ObjectId(a.accountId),
      movementId: a.movementId,
    })),
  };
}
