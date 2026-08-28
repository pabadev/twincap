import { ValidationError } from "./errors";
import { Money } from "./money";

/** Embedded abono for credits. */
export interface CreditAbono {
  id: string;
  amount: Money;
  date: Date;
  accountId: string;
  movementId?: string;
}

export interface CreditReceivedInput {
  id: string;
  userId: string;
  /** Lender name. */
  counterparty: string;
  principal: Money;
  /** Receiving account for the principal. */
  accountId: string;
  date: Date;
  /** Informational only — no auto-formulas (CRED-R-1). */
  installments?: number;
  /** Informational only — no auto-formulas (CRED-R-1). */
  frequency?: string;
  /**
   * Value of each installment (R5-C). Present when installments > 0 so the
   * total to pay can be derived: installmentValue × installments. Optional at
   * read time because legacy documents carry installments without a value
   * (they fall back to principal). R5-D1 enforcement lives in the creation
   * use cases, not here — see create-credit-received.ts.
   */
  installmentValue?: Money;
  createdAt: Date;
}

export class CreditReceived {
  readonly id: string;
  readonly userId: string;
  readonly counterparty: string;
  readonly principal: Money;
  readonly accountId: string;
  readonly date: Date;
  readonly installments?: number;
  readonly frequency?: string;
  /** Value of each installment; only present when installments > 0 (R5-C). */
  readonly installmentValue?: Money;
  readonly createdAt: Date;

  private readonly _abonos: ReadonlyArray<CreditAbono>;

  /**
   * Derived total to pay (R5-C). When a credit has installments AND an
   * installment value, the payable total is value × count. Otherwise it falls
   * back to the principal — covering legacy data (installments stored without
   * a value). Never stored.
   */
  get totalToPay(): number {
    return this.installments && this.installments > 0 && this.installmentValue
      ? this.installmentValue.amount * this.installments
      : this.principal.amount;
  }

  /** Derived pending = totalToPay − Σ abonos (CRED-R-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.totalToPay - abonoSum;
  }

  get abonos(): ReadonlyArray<CreditAbono> {
    return this._abonos;
  }

  constructor(input: CreditReceivedInput, abonos: CreditAbono[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("CreditReceived id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("CreditReceived userId must not be empty");
    }
    const counterparty = input.counterparty.trim();
    if (counterparty.length === 0) {
      throw new ValidationError("CreditReceived counterparty must not be empty");
    }
    if (input.principal.amount <= 0) {
      throw new ValidationError("CreditReceived principal must be positive");
    }
    if (input.accountId.length === 0) {
      throw new ValidationError("CreditReceived accountId must not be empty");
    }

    // Validate abonos
    let abonoSum = 0;
    for (const a of abonos) {
      if (a.amount.amount <= 0) {
        throw new ValidationError("CreditReceived abono amount must be positive");
      }
      if (a.accountId.length === 0) {
        throw new ValidationError("CreditReceived abono accountId must not be empty");
      }
      abonoSum += a.amount.amount;
    }
    // CRED-R-2: overpayment rejected — against the derived total to pay
    // (installments × installmentValue when present, else principal). This
    // mirrors the totalToPay getter so reconstruction of legacy/current docs
    // never throws here.
    const totalToPay =
      input.installments && input.installments > 0 && input.installmentValue
        ? input.installmentValue.amount * input.installments
        : input.principal.amount;
    if (abonoSum > totalToPay) {
      throw new ValidationError("CreditReceived abonos exceed total to pay (overpayment rejected)");
    }

    this.id = input.id;
    this.userId = input.userId;
    this.counterparty = counterparty;
    this.principal = input.principal;
    this.accountId = input.accountId;
    this.date = input.date;
    this.installments = input.installments;
    this.frequency = input.frequency;
    this.installmentValue = input.installmentValue;
    this.createdAt = input.createdAt;
    this._abonos = abonos;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      counterparty: this.counterparty,
      principal: this.principal.toJSON(),
      accountId: this.accountId,
      date: this.date,
      installments: this.installments,
      frequency: this.frequency,
      installmentValue: this.installmentValue?.toJSON(),
      totalToPay: this.totalToPay,
      createdAt: this.createdAt,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCreditReceived = ReturnType<CreditReceived['toJSON']>;
