/**
 * ISO 4217 currency codes supported by TwinCap.
 * Money amounts are stored as integer minor units per each currency's
 * exponent (COP has 0 decimals; USD, MXN, EUR have 2).
 */
export const CURRENCIES = ["COP", "USD", "MXN", "EUR"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Default currency for new accounts (proposal resolution). */
export const DEFAULT_CURRENCY: Currency = "COP";

/** Number of decimal places per ISO 4217 exponent. */
export const CURRENCY_EXPONENTS: Record<Currency, number> = {
  COP: 0,
  USD: 2,
  MXN: 2,
  EUR: 2,
};

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function exponentOf(currency: Currency): number {
  return CURRENCY_EXPONENTS[currency];
}
