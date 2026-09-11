import type { Currency } from '../../../domain/currency';

export interface CreatePayableInput {
  counterparty: string;
  /** Purchase total in minor units, > 0. Stored as TOTAL, never netted. */
  total: number;
  currency: Currency;
  /** Paid at acquisition time; >= 0 and <= total. Defaults to 0. */
  initialPayment?: number;
  accountId: string;
  date: Date;
  dueDate?: Date;
  note?: string;
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

export interface EditTotalInput {
  total: number; // minor units, > 0
  currency: Currency;
}
