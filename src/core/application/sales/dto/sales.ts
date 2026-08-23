import type { Currency } from '../../../domain/currency';
import type { PaymentMode } from '../../../domain/sale';

export interface CreateSaleInput {
  items: { itemId: string; quantity: number; unitPrice: number }[];
  accountId: string;
  clientId?: string;
  date: Date;
  paymentMode: PaymentMode;
  currency: Currency;
  /**
   * H14: upfront payment for on-credit sales (minor units, 0 ≤ x ≤ total).
   * 0 or omitted → no movement. Ignored/rejected for paid-in-full.
   */
  initialPayment?: number;
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

/**
 * H17: read model for the sale detail modal. Plain literals and Dates only —
 * safe to cross the server→client boundary.
 */
export interface SaleDetailSnapshot {
  id: string;
  date: Date;
  /** Resolved client name; null for the general client or missing reference. */
  clientName: string | null;
  paymentMode: PaymentMode;
  /** Derived: 'paid' when nothing is pending, 'pending' otherwise. */
  status: 'paid' | 'pending';
  items: {
    itemName: string | null;
    quantity: number;
    unitPrice: { amount: number; currency: Currency };
    subtotal: number;
  }[];
  total: number;
  initialPayment: number;
  pending: number;
  /** True when the pending/abonos come from the linked CreditGranted (H14). */
  hasLinkedCredit: boolean;
  abonos: { id: string; amount: { amount: number; currency: Currency }; date: Date }[];
  accountName: string | null;
  currency: Currency;
}
