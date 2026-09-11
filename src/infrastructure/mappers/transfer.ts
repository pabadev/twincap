import { Types } from "mongoose";
import type { TransferDocument } from "../models/transfer";
import { Transfer } from "../../core/domain/transfer";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/** Convert a Mongoose TransferDocument to a domain Transfer entity. */
export function toTransferEntity(doc: TransferDocument): Transfer {
  return new Transfer({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    sourceAccountId: doc.sourceAccountId.toString(),
    destinationAccountId: doc.destinationAccountId.toString(),
    sourceAmount: new Money(doc.sourceAmount, doc.sourceCurrency as Currency),
    destinationAmount: new Money(
      doc.destinationAmount,
      doc.destinationCurrency as Currency,
    ),
    sourceCurrency: doc.sourceCurrency as Currency,
    destinationCurrency: doc.destinationCurrency as Currency,
    // Dual legacy support (R15.1 Fase 4): new docs carry
    // effectiveExchangeRate; pre-migration docs only have `rate`.
    effectiveExchangeRate: doc.effectiveExchangeRate ?? doc.rate ?? undefined,
    date: doc.date,
    note: doc.note,
    movementIds: doc.movementIds
      ? {
          expenseId: doc.movementIds.expenseId,
          incomeId: doc.movementIds.incomeId,
        }
      : undefined,
    createdAt: doc.createdAt,
    // R15.3 §5: CAS needs the persisted version (`__v` exists from creation).
    version: doc.__v ?? 0,
  });
}

/** Convert a domain Transfer entity to plain data for Mongoose writes. */
export function toTransferDocData(entity: Transfer): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    sourceAccountId: new Types.ObjectId(entity.sourceAccountId),
    destinationAccountId: new Types.ObjectId(entity.destinationAccountId),
    sourceAmount: entity.sourceAmount.amount,
    destinationAmount: entity.destinationAmount.amount,
    sourceCurrency: entity.sourceCurrency,
    destinationCurrency: entity.destinationCurrency,
    effectiveExchangeRate: entity.effectiveExchangeRate,
    date: entity.date,
    note: entity.note,
    // R5-B: persist movementIds so deleteTransfer can actually reverse both
    // legs. Previously omitted — the saved doc never stored them, so deleting
    // a transfer left its two movements orphaned (they kept counting in
    // balances/dashboard and were unreachable from the UI). Stored as plain
    // strings: movements carry custom string ids (UUIDs), NOT ObjectIds, so
    // wrapping them would throw.
    movementIds: entity.movementIds
      ? {
          expenseId: entity.movementIds.expenseId,
          incomeId: entity.movementIds.incomeId,
        }
      : undefined,
    createdAt: entity.createdAt,
  };
}
