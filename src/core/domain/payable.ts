import { ValidationError } from "./errors";
import { Money } from "./money";

/** Embedded abono for payables (payments toward a purchase on credit). */
export interface PayableAbono {
  id: string;
  amount: Money;
  date: Date;
  accountId: string;
  movementId?: string;
}

export interface PayableInput {
  id: string;
  workspaceId: string;
  /** Vendor / seller name (free text). */
  counterparty: string;
  /** Purchase total — stored as TOTAL debt, never netted (PAY-R-1). */
  total: Money;
  /** Amount paid at acquisition time. >= 0 and <= total. */
  initialPayment: number;
  /** Account the initial payment left from. */
  accountId: string;
  date: Date;
  /** Informational only — no auto-formulas. */
  dueDate?: Date;
  note?: string;
  createdAt: Date;
}

/**
 * Cuenta por pagar (purchase on credit) — semantic mirror of CreditReceived.
 *
 * The record stores the purchase TOTAL; pending is always derived
 * (total − initialPayment − Σ abonos), never stored, so Money keeps its
 * strict positive invariant everywhere (PAY-R-1).
 */
export class Payable {
  readonly id: string;
  readonly workspaceId: string;
  readonly counterparty: string;
  readonly total: Money;
  readonly initialPayment: number;
  readonly accountId: string;
  readonly date: Date;
  readonly   dueDate?: Date;
  readonly note?: string;
  readonly createdAt: Date;

  private readonly _abonos: ReadonlyArray<PayableAbono>;

  /** Derived pending = total − initialPayment − Σ abonos (PAY-R-2). Never stored. */
  get pending(): number {
    const abonoSum = this._abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    return this.total.amount - this.initialPayment - abonoSum;
  }

  get abonos(): ReadonlyArray<PayableAbono> {
    return this._abonos;
  }

  constructor(input: PayableInput, abonos: PayableAbono[] = []) {
    if (input.id.length === 0) {
      throw new ValidationError("Payable id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Payable workspaceId must not be empty");
    }
    const counterparty = input.counterparty.trim();
    if (counterparty.length === 0) {
      throw new ValidationError("Payable counterparty must not be empty");
    }
    // total is strict positive via Money's own invariant.
    if (!Number.isSafeInteger(input.initialPayment)) {
      throw new ValidationError(
        `Payable initialPayment must be an integer in minor units, got ${input.initialPayment}`,
      );
    }
    if (input.initialPayment < 0) {
      throw new ValidationError("Payable initialPayment must not be negative");
    }
    if (input.initialPayment > input.total.amount) {
      throw new ValidationError("Payable initialPayment exceeds total");
    }
    if (input.accountId.length === 0) {
      throw new ValidationError("Payable accountId must not be empty");
    }

    // Validate abonos
    let abonoSum = 0;
    for (const a of abonos) {
      if (a.amount.amount <= 0) {
        throw new ValidationError("Payable abono amount must be positive");
      }
      if (a.accountId.length === 0) {
        throw new ValidationError("Payable abono accountId must not be empty");
      }
      abonoSum += a.amount.amount;
    }
    // PAY-R-2: overpayment rejected (initial payment + abonos <= total)
    if (input.initialPayment + abonoSum > input.total.amount) {
      throw new ValidationError("Payable payments exceed total (overpayment rejected)");
    }

    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.counterparty = counterparty;
    this.total = input.total;
    this.initialPayment = input.initialPayment;
    this.accountId = input.accountId;
    this.date = input.date;
    this.dueDate = input.dueDate;
    this.note = input.note;
    this.createdAt = input.createdAt;
    this._abonos = abonos;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      counterparty: this.counterparty,
      total: this.total.toJSON(),
      initialPayment: this.initialPayment,
      accountId: this.accountId,
      date: this.date,
      dueDate: this.dueDate,
      note: this.note,
      createdAt: this.createdAt,
      pending: this.pending,
      abonos: this._abonos.map((a) => ({ ...a, amount: a.amount.toJSON() })),
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedPayable = ReturnType<Payable['toJSON']>;
