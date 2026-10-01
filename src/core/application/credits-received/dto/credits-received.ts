import type { Currency } from "../../../domain/currency";
import type { MovementContext } from "../../../domain/movement";

export interface CreateCreditReceivedInput {
  counterparty: string;
  principal: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
  installments?: number;
  /** Value per installment (R5-C). Required when installments > 0 (R5-D1). */
  installmentValue?: number; // minor units, > 0
  frequency?: string;
  /**
   * EXC-1 (freeze exception, founder 2026-09-30): user-selectable Personal/
   * Business context for the derived principal movement. Default 'Personal'
   * (legacy semantics preserved byte-to-byte); validated by the use case.
   */
  context?: MovementContext;
}

export interface AddAbonoInput {
  amount: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
}

export interface EditAbonoInput {
  /**
   * Changing the account of an abono is NOT an intentional product
   * capability (R15.3 §16) — the embedded abono keeps the accountId fixed at
   * addAbono time. Edits are amount/date only.
   */
  amount?: number;
  date?: Date;
}

export interface EditPrincipalInput {
  principal: number; // minor units, > 0
  currency: Currency;
}
