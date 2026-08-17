import type { Currency } from '../../../domain/currency';

export interface CreateTransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number; // minor units, > 0
  sourceCurrency: Currency;
  destinationAmount?: number; // for cross-currency; same-currency = sourceAmount
  destinationCurrency?: Currency;
  rate?: number; // manual FX rate for cross-currency (TRA-3)
  date: Date;
  note?: string;
}
