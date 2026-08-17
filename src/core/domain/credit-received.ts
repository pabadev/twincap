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
  readonly createdAt: Date;

  private readonly _abonos: ReadonlyArray<CreditAbono>;

  /** Derived pending = principal − Σ abonos (CRED-R-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.principal.amount - abonoSum;
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
    // CRED-R-2: overpayment rejected
    if (abonoSum > input.principal.amount) {
      throw new ValidationError("CreditReceived abonos exceed principal (overpayment rejected)");
    }

    this.id = input.id;
    this.userId = input.userId;
    this.counterparty = counterparty;
    this.principal = input.principal;
    this.accountId = input.accountId;
    this.date = input.date;
    this.installments = input.installments;
    this.frequency = input.frequency;
    this.createdAt = input.createdAt;
    this._abonos = abonos;
  }
}
