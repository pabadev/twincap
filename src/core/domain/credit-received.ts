import { ValidationError } from "./errors";
import { Money, assertSafeMinorUnits } from "./money";

/** Embedded abono for credits. */
export interface CreditAbono {
  id: string;
  amount: Money;
  date: Date;
  accountId: string;
  movementId?: string;
  /**
   * Capital portion of this abono (R9/D9.3) — informative, derived from the
   * chronological amortization split. Optional; credits received do not set it
   * and only tolerate the field.
   */
  capitalAmount?: Money;
  /**
   * Interest portion of this abono (R9/D9.3) — informative, derived from the
   * chronological amortization split. Optional; credits received do not set it
   * and only tolerate the field.
   */
  interestAmount?: Money;
  /**
   * Linked interest movement when the abono split into capital + interest
   * (R9/D9.1). Optional; set only on credits granted standalone. Credits
   * received do not set it and only tolerate the field.
   */
  interestMovementId?: string;
}

export interface CreditReceivedInput {
  id: string;
  workspaceId: string;
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
  /**
   * Optimistic-concurrency version (mirrors the document's `__v`, default 0).
   * Applied via CAS on versioned writes and bumped on each successful write.
   */
  version?: number;
}

export class CreditReceived {
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
  readonly createdAt: Date;
  /** Optimistic-concurrency version (`__v`), default 0. */
  readonly version: number;

  private readonly _abonos: ReadonlyArray<CreditAbono>;

  /**
   * Derived total to pay (R5-C). When a credit has installments AND an
   * installment value, the payable total is value × count. Otherwise it falls
   * back to the principal — covering legacy data (installments stored without
   * a value). Never stored.
   */
  get totalToPay(): number {
    if (this.installments && this.installments > 0 && this.installmentValue) {
      // R15.3 §18: fail fast BEFORE the derived total is consumed — the
      // multiplication can overflow the safe-integer range before re-entering
      // Money.
      const total = this.installmentValue.amount * this.installments;
      assertSafeMinorUnits(total, "CreditReceived totalToPay");
      return total;
    }
    return this.principal.amount;
  }

  /** Derived pending = totalToPay − Σ abonos (CRED-R-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    assertSafeMinorUnits(abonoSum, "CreditReceived abonos sum");
    const pending = this.totalToPay - abonoSum;
    assertSafeMinorUnits(pending, "CreditReceived pending");
    return pending;
  }

  get abonos(): ReadonlyArray<CreditAbono> {
    return this._abonos;
  }

  constructor(input: CreditReceivedInput, abonos: CreditAbono[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("CreditReceived id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("CreditReceived workspaceId must not be empty");
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
    // R15.3 §18: the accumulated abono sum itself must stay a safe integer
    // before it can be compared against the derived total.
    assertSafeMinorUnits(abonoSum, "CreditReceived constructor abonos sum");
    // CRED-R-2: overpayment rejected — against the derived total to pay
    // (installments × installmentValue when present, else principal). This
    // mirrors the totalToPay getter so reconstruction of legacy/current docs
    // never throws here.
    let totalToPay = input.principal.amount;
    if (input.installments && input.installments > 0 && input.installmentValue) {
      // R15.3 §18: fail fast before the derived total is consumed.
      totalToPay = input.installmentValue.amount * input.installments;
      assertSafeMinorUnits(totalToPay, "CreditReceived constructor totalToPay");
    }
    if (abonoSum > totalToPay) {
      throw new ValidationError("CreditReceived abonos exceed total to pay (overpayment rejected)");
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
    this.createdAt = input.createdAt;
    this.version = input.version ?? 0;
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
      createdAt: this.createdAt,
      version: this.version,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedCreditReceived = ReturnType<CreditReceived['toJSON']>;
