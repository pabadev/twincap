import type { Currency } from '../../../domain/currency';

export interface CreateTransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number; // minor units, > 0
  sourceCurrency: Currency;
  /**
   * Required for cross-currency transfers (> 0). For same-currency transfers
   * it stays optional at the type level: the use case derives
   * destination = sourceAmount internally (TRA-2 equality).
   */
  destinationAmount?: number;
  destinationCurrency?: Currency;
  // R15.1 Fase 4: `rate` was removed — the effective exchange rate is DERIVED
  // from sourceAmount / destinationAmount, never accepted as user input.
  date: Date;
  note?: string;
  /**
   * R15.1 Fase 5: when true, a negative projected source balance is accepted
   * and recorded as declared financial reality (no warning is emitted).
   * When falsy/absent and the projected balance is negative, the use case
   * returns an InsufficientFundsWarning and writes nothing.
   */
  confirmNegativeBalance?: boolean;
}
