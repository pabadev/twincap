import { Types } from "mongoose";
import type { CreditReceivedDocument } from "../models/credit-received";
import {
  CreditReceived,
  type CreditAbono,
} from "../../core/domain/credit-received";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose CreditReceivedDocument to a domain CreditReceived entity.
 *
 * The doc stores principal and abono amounts as raw numbers. The Currency
 * must be provided by the caller (the credit's account currency).
 */
export function toCreditReceivedEntity(
  doc: CreditReceivedDocument,
  currency: Currency,
): CreditReceived {
  const abonos: CreditAbono[] = doc.abonos.map((a) => ({
    id: a.id,
    amount: new Money(a.amount, currency),
    date: a.date,
    accountId: a.accountId.toString(),
    movementId: a.movementId,
  }));

  return new CreditReceived(
    {
      id: doc._id.toString(),
      workspaceId: doc.workspaceId.toString(),
      counterparty: doc.counterparty,
      principal: new Money(doc.principal, currency),
      accountId: doc.accountId.toString(),
      date: doc.date,
      installments: doc.installments,
      installmentValue:
        doc.installmentValue !== undefined
          ? new Money(doc.installmentValue, currency)
          : undefined,
      frequency: doc.frequency,
      createdAt: doc.createdAt,
    },
    abonos,
  );
}

/** Convert a domain CreditReceived entity to plain data for Mongoose writes. */
export function toCreditReceivedDocData(
  entity: CreditReceived,
): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    counterparty: entity.counterparty,
    principal: entity.principal.amount,
    accountId: new Types.ObjectId(entity.accountId),
    date: entity.date,
    installments: entity.installments,
    installmentValue: entity.installmentValue?.amount,
    frequency: entity.frequency,
    abonos: entity.abonos.map((a) => ({
      id: a.id,
      amount: a.amount.amount,
      date: a.date,
      accountId: new Types.ObjectId(a.accountId),
      movementId: a.movementId,
    })),
  };
}
