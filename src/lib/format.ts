import { CURRENCY_EXPONENTS } from '@/core/domain/currency';

/**
 * Format a money amount using Intl.NumberFormat.
 * @param amount - The amount in minor units (cents)
 * @param currency - Currency code (COP, USD, MXN, EUR)
 * @param locale - Locale string (es, en)
 */
export function formatAmount(amount: number, currency: string, locale: string): string {
  const exponent = (CURRENCY_EXPONENTS as Record<string, number>)[currency] ?? 2;
  const value = amount / Math.pow(10, exponent);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value);
}

/**
 * Format a date string using Intl.DateTimeFormat.
 * @param dateStr - ISO date string (YYYY-MM-DD) or Date object
 * @param locale - Locale string (es, en)
 */
export function formatDate(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
