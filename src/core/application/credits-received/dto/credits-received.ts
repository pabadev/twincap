import type { Currency } from '../../../domain/currency';

export interface CreateCreditReceivedInput {
  counterparty: string;
  principal: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
  installments?: number;
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
