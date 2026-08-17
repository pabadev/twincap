import { type Currency } from "./currency";
import { ValidationError } from "./errors";
import { Money } from "./money";

/**
 * Transfer represents a two-linked-movements operation:
 * one expense on the source account and one income on the destination account.
 * TRA-1..4 spec requirements.
 */
export interface TransferInput {
  id: string;
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: Money;
  destinationAmount: Money;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  /** Only required/meaningful for cross-currency transfers (TRA-3). */
  rate?: number;
  date: Date;
  note?: string;
  createdAt: Date;
}

export class Transfer {
  readonly id: string;
  readonly userId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly sourceAmount: Money;
  readonly destinationAmount: Money;
  readonly sourceCurrency: Currency;
  readonly destinationCurrency: Currency;
  readonly rate?: number;
  readonly date: Date;
  readonly note?: string;
  readonly createdAt: Date;

  constructor(input: TransferInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Transfer id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Transfer userId must not be empty");
    }
    if (input.sourceAccountId.length === 0) {
      throw new ValidationError("Transfer sourceAccountId must not be empty");
    }
    if (input.destinationAccountId.length === 0) {
      throw new ValidationError("Transfer destinationAccountId must not be empty");
    }
    // TRA-1: source and destination must differ
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new ValidationError("Transfer source and destination accounts must be different");
    }
    if (input.sourceAmount.amount <= 0) {
      throw new ValidationError("Transfer sourceAmount must be positive");
    }
    if (input.destinationAmount.amount <= 0) {
      throw new ValidationError("Transfer destinationAmount must be positive");
    }

    const isCrossCurrency = input.sourceCurrency !== input.destinationCurrency;

    if (isCrossCurrency) {
      // TRA-3: cross-currency requires a rate and positive destinationAmount
      if (input.rate === undefined || input.rate <= 0) {
        throw new ValidationError("Cross-currency transfer requires a positive FX rate");
      }
      if (input.destinationAmount.amount <= 0) {
        throw new ValidationError("Cross-currency transfer destinationAmount must be positive");
      }
    } else {
      // TRA-2: same-currency requires equal amounts
      if (input.sourceAmount.amount !== input.destinationAmount.amount) {
        throw new ValidationError(
          "Same-currency transfer requires sourceAmount equal to destinationAmount",
        );
      }
    }

    this.id = input.id;
    this.userId = input.userId;
    this.sourceAccountId = input.sourceAccountId;
    this.destinationAccountId = input.destinationAccountId;
    this.sourceAmount = input.sourceAmount;
    this.destinationAmount = input.destinationAmount;
    this.sourceCurrency = input.sourceCurrency;
    this.destinationCurrency = input.destinationCurrency;
    this.rate = input.rate;
    this.date = input.date;
    this.note = input.note;
    this.createdAt = input.createdAt;
  }
}
