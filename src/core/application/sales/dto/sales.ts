import type { Currency } from '../../../domain/currency';
import type { PaymentMode } from '../../../domain/sale';

export interface CreateSaleInput {
  items: { itemId: string; quantity: number; unitPrice: number }[];
  accountId: string;
  date: Date;
  paymentMode: PaymentMode;
  currency: Currency;
}

export interface AddSaleAbonoInput {
  amount: number; // minor units, > 0
  currency: Currency;
  accountId: string;
  date: Date;
}

export interface EditSaleAbonoInput {
  amount?: number;
  accountId?: string;
  date?: Date;
  currency?: Currency;
}

export interface EditSaleLineItemInput {
  quantity?: number;
  unitPrice?: number; // minor units, > 0
}
