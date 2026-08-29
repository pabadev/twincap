import { Types } from "mongoose";
import type { CreditGrantedDocument } from "../models/credit-granted";
import { CreditGranted } from "../../core/domain/credit-granted";
import type { CreditAbono } from "../../core/domain/credit-received";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose CreditGrantedDocument to a domain CreditGranted entity.
 *
 * The doc stores principal and abono amounts as raw numbers. The Currency
 * must be provided by the caller (the credit's account currency).
 */
export function toCreditGrantedEntity(
  doc: CreditGrantedDocument,
  currency: Currency,
): CreditGranted {
  const abonos: CreditAbono[] = doc.abonos.map((a) => ({
    id: a.id,
    amount: new Money(a.amount, currency),
    date: a.date,
    accountId: a.accountId.toString(),
    movementId: a.movementId,
    capitalAmount: a.capitalAmount !== undefined ? new Money(a.capitalAmount, currency) : undefined,
    interestAmount: a.interestAmount !== undefined ? new Money(a.interestAmount, currency) : undefined,
    interestMovementId: a.interestMovementId,
  }));

  return new CreditGranted(
    {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      counterparty: doc.counterparty,
      // H14: sale-born credits can be stored with principal 0 (born
      // paid-in-full), so reconstruction must allow non-negative amounts.
      principal: Money.nonNegative(doc.principal, currency),
      accountId: doc.accountId.toString(),
      date: doc.date,
      installments: doc.installments,
      installmentValue:
        doc.installmentValue !== undefined
          ? new Money(doc.installmentValue, currency)
          : undefined,
      frequency: doc.frequency,
      saleId: doc.saleId,
      writtenOff: doc.writtenOff
        ? { date: doc.writtenOff.date, movementId: doc.writtenOff.movementId }
        : undefined,
      createdAt: doc.createdAt,
    },
    abonos,
  );
}

/** Convert a domain CreditGranted entity to plain data for Mongoose writes. */
export function toCreditGrantedDocData(
  entity: CreditGranted,
): Record<string, unknown> {
  return {
    userId: new Types.ObjectId(entity.userId),
    counterparty: entity.counterparty,
    principal: entity.principal.amount,
    accountId: new Types.ObjectId(entity.accountId),
    date: entity.date,
    installments: entity.installments,
    installmentValue: entity.installmentValue?.amount,
    frequency: entity.frequency,
    saleId: entity.saleId,
    writtenOff: entity.writtenOff,
    abonos: entity.abonos.map((a) => ({
      id: a.id,
      amount: a.amount.amount,
      date: a.date,
      accountId: new Types.ObjectId(a.accountId),
      movementId: a.movementId,
      capitalAmount: a.capitalAmount?.amount,
      interestAmount: a.interestAmount?.amount,
      interestMovementId: a.interestMovementId,
    })),
  };
}
