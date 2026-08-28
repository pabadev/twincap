import type { Currency } from '../../../domain/currency';

export interface CreateCreditGrantedInput {
  counterparty: string;
  principal: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
  installments?: number;
  /** Value per installment (R5-C). Required when installments > 0 (R5-D1). */
  installmentValue?: number; // minor units, > 0
  frequency?: string;
}

export interface AddAbonoInput {
  amount: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
}

export interface EditAbonoInput {
  amount?: number;
  accountId?: string;
  date?: Date;
}

export interface EditPrincipalInput {
  principal: number; // minor units, > 0
  currency: Currency;
}
