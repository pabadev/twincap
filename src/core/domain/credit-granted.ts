import { ValidationError } from "./errors";
import { Money } from "./money";

/** Re-export CreditAbono for credits-granted (same shape as received). */
export type { CreditAbono } from "./credit-received";

export interface CreditGrantedInput {
  id: string;
  userId: string;
  /** Debtor name. */
  counterparty: string;
  principal: Money;
  /** Paying account for the principal. */
  accountId: string;
  date: Date;
  /** Informational only — no auto-formulas (CRED-G-1). */
  installments?: number;
  /** Informational only — no auto-formulas (CRED-G-1). */
  frequency?: string;
  /**
   * Optional link to the POS sale that originated this credit (H14).
   * Set automatically by createSale; never set by the standalone flow.
   */
  saleId?: string;
  createdAt: Date;
}

/** Re-use the CreditAbono type from credit-received (same shape). */
interface CreditAbono {
  id: string;
  amount: Money;
  date: Date;
  accountId: string;
  movementId?: string;
}

export class CreditGranted {
  readonly id: string;
  readonly userId: string;
  readonly counterparty: string;
  readonly principal: Money;
  readonly accountId: string;
  readonly date: Date;
  readonly installments?: number;
  readonly frequency?: string;
  /** Origin POS sale, when the credit was born from a sale (H14). */
  readonly saleId?: string;
  readonly createdAt: Date;

  private readonly _abonos: ReadonlyArray<CreditAbono>;

  /** Derived pending = principal − Σ abonos (CRED-G-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.principal.amount - abonoSum;
  }

  get abonos(): ReadonlyArray<CreditAbono> {
    return this._abonos;
  }

  constructor(input: CreditGrantedInput, abonos: CreditAbono[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("CreditGranted id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("CreditGranted userId must not be empty");
    }
    const counterparty = input.counterparty.trim();
    if (counterparty.length === 0) {
      throw new ValidationError("CreditGranted counterparty must not be empty");
    }
    // Principal must not be negative. Zero is valid for credits born from a
    // POS sale fully paid upfront (initialPayment = total → born paid-in-full,
    // pending = 0, no principal movement). The standalone create flow keeps
    // its own positive-principal expectation at the form/DTO level.
    if (input.principal.amount < 0) {
      throw new ValidationError("CreditGranted principal must not be negative");
    }
    if (input.accountId.length === 0) {
      throw new ValidationError("CreditGranted accountId must not be empty");
    }

    // Validate abonos
    let abonoSum = 0;
    for (const a of abonos) {
      if (a.amount.amount <= 0) {
        throw new ValidationError("CreditGranted abono amount must be positive");
      }
      if (a.accountId.length === 0) {
        throw new ValidationError("CreditGranted abono accountId must not be empty");
      }
      abonoSum += a.amount.amount;
    }
    // CRED-G-2: overpayment rejected
    if (abonoSum > input.principal.amount) {
      throw new ValidationError("CreditGranted abonos exceed principal (overpayment rejected)");
    }

    this.id = input.id;
    this.userId = input.userId;
    this.counterparty = counterparty;
    this.principal = input.principal;
    this.accountId = input.accountId;
    this.date = input.date;
    this.installments = input.installments;
    this.frequency = input.frequency;
    this.saleId = input.saleId;
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
      saleId: this.saleId,
      createdAt: this.createdAt,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCreditGranted = ReturnType<CreditGranted['toJSON']>;
