import { CURRENCY_EXPONENTS } from "@/core/domain/currency";

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
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value);
}

/**
 * A2 (F4): split a formatted money value into amount and currency suffix so
 * the suffix can be rendered with `whitespace-nowrap shrink-0` to prevent it
 * from wrapping onto its own line at narrow widths (§21 refinement).
 *
 * Intl `style:'currency'` emits the currency token in different positions:
 * - es: "$1.234.567,89 COP" (symbol+amount first, code last)
 * - en: "COP 1,234,567.89" (code first, symbol+amount last)
 *
 * This helper detects the currency code position and returns:
 * - `amount`: the numeric part with symbol (may wrap internally)
 * - `suffix`: the currency code token (never wraps alone)
 *
 * The caller renders them in locale-honest order (suffix after amount in es,
 * before in en) by concatenating in the original formatted order.
 */
export function formatAmountParts(
  amount: number,
  currency: string,
  locale: string,
): { amount: string; suffix: string; suffixFirst: boolean } {
  const formatted = formatAmount(amount, currency, locale);
  // The currency code is typically 3 uppercase letters. Detect its position.
  const codeMatch = formatted.match(/\b([A-Z]{3})\b/);
  if (!codeMatch || codeMatch.index === undefined) {
    // Fallback: no currency code found, return as-is with empty suffix.
    return { amount: formatted, suffix: "", suffixFirst: false };
  }
  const suffix = codeMatch[1];
  const codeIndex = codeMatch.index;
  const beforeCode = formatted.slice(0, codeIndex).trim();
  const afterCode = formatted.slice(codeIndex + suffix.length).trim();

  if (codeIndex === 0) {
    // en-style: "COP 1,234,567.89" — code first, amount after.
    return { amount: afterCode, suffix, suffixFirst: true };
  } else {
    // es-style: "$1.234.567,89 COP" — amount first, code last.
    return { amount: beforeCode, suffix, suffixFirst: false };
  }
}

/**
 * Format a BUSINESS date using Intl.DateTimeFormat.
 *
 * Business dates (movement/transfer/credit/sale/payable dates) are stored as
 * civil dates encoded as midnight UTC (decision D1). Rendering them MUST pin
 * `timeZone: 'UTC'` so the displayed calendar date matches the stored civil
 * date on any host timezone. Do NOT use this formatter for true instants
 * (createdAt/updatedAt) — those should render in local time.
 *
 * @param date - ISO date string (YYYY-MM-DD) or Date object
 * @param locale - Locale string (es, en)
 */
export function formatDate(date: Date | string, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}
