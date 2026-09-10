import { type Currency } from "./currency";
import { ValidationError } from "./errors";
import { Money } from "./money";

/**
 * Transfer represents a two-linked-movements operation:
 * one expense on the source account and one income on the destination account.
 * TRA-1..4 spec requirements.
 */
export interface TransferMovementIds {
  expenseId?: string;
  incomeId?: string;
}

export interface TransferInput {
  id: string;
  workspaceId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: Money;
  destinationAmount: Money;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  /**
   * Derived from sourceAmount / destinationAmount. Never user-input.
   * Only meaningful for cross-currency transfers (TRA-3).
   */
  effectiveExchangeRate?: number;
  date: Date;
  note?: string;
  /** Linked movement IDs — populated after transfer completion (design §5). */
  movementIds?: TransferMovementIds;
  createdAt: Date;
}

export class Transfer {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly sourceAmount: Money;
  readonly destinationAmount: Money;
  readonly sourceCurrency: Currency;
  readonly destinationCurrency: Currency;
  readonly effectiveExchangeRate?: number;
  readonly date: Date;
  readonly note?: string;
  readonly movementIds?: TransferMovementIds;
  readonly createdAt: Date;

  constructor(input: TransferInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Transfer id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Transfer workspaceId must not be empty");
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
      // TRA-3 (R15.1 Fase 4): the exchange rate is DERIVED from both amounts —
      // the user never enters it. The use case computes it; the entity only
      // guards that an explicitly provided derived value is positive. Both
      // amounts are already validated positive above (TRA-general).
      if (
        input.effectiveExchangeRate !== undefined &&
        input.effectiveExchangeRate <= 0
      ) {
        throw new ValidationError(
          "Cross-currency transfer effectiveExchangeRate must be positive",
        );
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
    this.workspaceId = input.workspaceId;
    this.sourceAccountId = input.sourceAccountId;
    this.destinationAccountId = input.destinationAccountId;
    this.sourceAmount = input.sourceAmount;
    this.destinationAmount = input.destinationAmount;
    this.sourceCurrency = input.sourceCurrency;
    this.destinationCurrency = input.destinationCurrency;
    this.effectiveExchangeRate = input.effectiveExchangeRate;
    this.date = input.date;
    this.note = input.note;
    this.movementIds = input.movementIds;
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      sourceAccountId: this.sourceAccountId,
      destinationAccountId: this.destinationAccountId,
      sourceAmount: this.sourceAmount.toJSON(),
      destinationAmount: this.destinationAmount.toJSON(),
      sourceCurrency: this.sourceCurrency,
      destinationCurrency: this.destinationCurrency,
      effectiveExchangeRate: this.effectiveExchangeRate,
      date: this.date,
      note: this.note,
      movementIds: this.movementIds,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedTransfer = ReturnType<Transfer['toJSON']>;
