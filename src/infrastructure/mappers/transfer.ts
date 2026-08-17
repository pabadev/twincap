import { Types } from "mongoose";
import type { TransferDocument } from "../models/transfer";
import { Transfer } from "../../core/domain/transfer";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/** Convert a Mongoose TransferDocument to a domain Transfer entity. */
export function toTransferEntity(doc: TransferDocument): Transfer {
  return new Transfer({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    sourceAccountId: doc.sourceAccountId.toString(),
    destinationAccountId: doc.destinationAccountId.toString(),
    sourceAmount: new Money(doc.sourceAmount, doc.sourceCurrency as Currency),
    destinationAmount: new Money(
      doc.destinationAmount,
      doc.destinationCurrency as Currency,
    ),
    sourceCurrency: doc.sourceCurrency as Currency,
    destinationCurrency: doc.destinationCurrency as Currency,
    rate: doc.rate,
    date: doc.date,
    note: doc.note,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Transfer entity to plain data for Mongoose writes. */
export function toTransferDocData(entity: Transfer): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(entity.id),
    userId: new Types.ObjectId(entity.userId),
    sourceAccountId: new Types.ObjectId(entity.sourceAccountId),
    destinationAccountId: new Types.ObjectId(entity.destinationAccountId),
    sourceAmount: entity.sourceAmount.amount,
    destinationAmount: entity.destinationAmount.amount,
    sourceCurrency: entity.sourceCurrency,
    destinationCurrency: entity.destinationCurrency,
    rate: entity.rate,
    date: entity.date,
    note: entity.note,
  };
}
