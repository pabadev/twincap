import { ValidationError } from "./errors";
import { Money } from "./money";
import type { CreditAbono } from "./credit-received";

/** Re-export CreditAbono for credits-granted (same shape as received). */
export type { CreditAbono } from "./credit-received";

export interface CreditGrantedInput {
  id: string;
  workspaceId: string;
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
   * Value of each installment (R5-C). Present when installments > 0 so the
   * total to pay can be derived: installmentValue × installments. Optional at
   * read time because legacy documents carry installments without a value
   * (they fall back to principal) and sale-born POS credits have no
   * installments at all (R5-D2). R5-D1 enforcement lives in the creation use
   * cases, not here — see create-credit-granted.ts.
   */
  installmentValue?: Money;
  /**
   * Optional link to the POS sale that originated this credit (H14).
   * Set automatically by createSale; never set by the standalone flow.
   */
  saleId?: string;
  /**
   * Write-off marker (R9/D9.4). Set when the credit is written off as
   * uncollectible, referencing the expense movement registered for the
   * unrecovered capital. No validation here — enforcement lives in the
   * write-off use case.
   */
  writtenOff?: { date: Date; movementId: string };
  createdAt: Date;
}

export class CreditGranted {
  readonly id: string;
  readonly workspaceId: string;
  readonly counterparty: string;
  readonly principal: Money;
  readonly accountId: string;
  readonly date: Date;
  readonly installments?: number;
  readonly frequency?: string;
  /** Value of each installment; only present when installments > 0 (R5-C). */
  readonly installmentValue?: Money;
  /** Origin POS sale, when the credit was born from a sale (H14). */
  readonly saleId?: string;
  /** Write-off marker when the credit was written off as uncollectible (R9/D9.4). */
  readonly writtenOff?: { date: Date; movementId: string };
  readonly createdAt: Date;

  private readonly _abonos: ReadonlyArray<CreditAbono>;

  /**
   * Derived total to pay (R5-C). When a credit has installments AND an
   * installment value, the payable total is value × count. Otherwise it falls
   * back to the principal — covering legacy data (installments stored without
   * a value) and sale-born POS credits, whose debt IS the net principal
   * (R5-D2). Never stored.
   */
  get totalToPay(): number {
    return this.installments && this.installments > 0 && this.installmentValue
      ? this.installmentValue.amount * this.installments
      : this.principal.amount;
  }

  /** Derived pending = totalToPay − Σ abonos (CRED-G-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.totalToPay - abonoSum;
  }

  get abonos(): ReadonlyArray<CreditAbono> {
    return this._abonos;
  }

  constructor(input: CreditGrantedInput, abonos: CreditAbono[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("CreditGranted id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("CreditGranted workspaceId must not be empty");
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
    // CRED-G-2: overpayment rejected — against the derived total to pay
    // (installments × installmentValue when present, else principal). This
    // mirrors the totalToPay getter so reconstruction of legacy/current docs
    // never throws here.
    const totalToPay =
      input.installments && input.installments > 0 && input.installmentValue
        ? input.installmentValue.amount * input.installments
        : input.principal.amount;
    if (abonoSum > totalToPay) {
      throw new ValidationError("CreditGranted abonos exceed total to pay (overpayment rejected)");
    }

    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.counterparty = counterparty;
    this.principal = input.principal;
    this.accountId = input.accountId;
    this.date = input.date;
    this.installments = input.installments;
    this.frequency = input.frequency;
    this.installmentValue = input.installmentValue;
    this.saleId = input.saleId;
    this.writtenOff = input.writtenOff;
    this.createdAt = input.createdAt;
    this._abonos = abonos;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      counterparty: this.counterparty,
      principal: this.principal.toJSON(),
      accountId: this.accountId,
      date: this.date,
      installments: this.installments,
      frequency: this.frequency,
      installmentValue: this.installmentValue?.toJSON(),
      totalToPay: this.totalToPay,
      saleId: this.saleId,
      writtenOff: this.writtenOff,
      createdAt: this.createdAt,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({
        ...a,
        amount: a.amount.toJSON(),
        capitalAmount: a.capitalAmount?.toJSON(),
        interestAmount: a.interestAmount?.toJSON(),
      })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCreditGranted = ReturnType<CreditGranted['toJSON']>;
