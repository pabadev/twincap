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
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  // Founder rule (PROJECT-RULES §15-UX.1, ronda final pre-beta 2026-09-30):
  // Spanish-speaking Latin America reads thousands with the dot from 1.000.
  // CLDR `es` defaults to minimumGroupingDigits: 2 (groups only from 10.000)
  // and the Intl option cannot be forced below that in this runtime — so for
  // locale "es" the Intl output is post-processed to insert the locale's OWN
  // group separator whenever the integer part has exactly 4 digits
  // (1.000–9.999; ≥10.000 already groups natively). The reconstruction uses
  // formatToParts, so symbols, codes, sign and decimal separator stay exactly
  // what Intl emits (formatAmountParts and E2E regex contracts intact).
  // Other locales (en, …) group from 1,000 natively and are untouched.
  if (locale === "es") {
    const parts = formatter.formatToParts(value);
    const integerDigits = parts
      .filter((part) => part.type === "integer")
      .map((part) => part.value)
      .join("");
    const alreadyGrouped = parts.some((part) => part.type === "group");
    if (!alreadyGrouped && integerDigits.length === 4) {
      const group =
        parts.find((part) => part.type === "group")?.value ??
        new Intl.NumberFormat(locale).formatToParts(1234.5).find((part) => part.type === "group")
          ?.value ??
        ".";
      let out = "";
      for (const part of parts) {
        if (part.type === "integer") {
          // Insert the separator before the last 3 digits of the 4-digit
          // integer run ("9999" → "9.999") without touching sign/text parts.
          out += part.value.slice(0, 1) + group + part.value.slice(1);
        } else {
          out += part.value;
        }
      }
      return out;
    }
  }
  return formatter.format(value);
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
): { sign: string; amount: string; suffix: string; suffixFirst: boolean } {
  const formatted = formatAmount(amount, currency, locale);
  // The currency code is typically 3 uppercase letters. Detect its position.
  const codeMatch = formatted.match(/\b([A-Z]{3})\b/);
  if (!codeMatch || codeMatch.index === undefined) {
    // Fallback: no currency code found, return as-is with empty suffix.
    return { sign: "", amount: formatted, suffix: "", suffixFirst: false };
  }
  const suffix = codeMatch[1];
  const codeIndex = codeMatch.index;
  const beforeCode = formatted.slice(0, codeIndex).trim();
  const afterCode = formatted.slice(codeIndex + suffix.length).trim();

  if (codeIndex === 0) {
    // en-style: "COP 1,234,567.89" — code first, amount after.
    return { sign: "", amount: afterCode, suffix, suffixFirst: true };
  }
  // en-style negative: Intl emits "-COP 5,000.00" — the sign precedes the
  // code, so beforeCode is decoration (no digits). The sign travels with the
  // suffix (it renders first), the digits stay in the amount part; the full
  // string rebuilds exactly what Intl emitted and E2E regexes depend on the
  // "−<CODE> <amount>" adjacency.
  if (!/\p{Nd}/u.test(beforeCode)) {
    return { sign: beforeCode, amount: afterCode, suffix, suffixFirst: true };
  }
  // es-style: amount first, code last (sign already leading in beforeCode,
  // e.g. "-5.000,00 COP"): the full amount (with its sign) renders first.
  return { sign: "", amount: beforeCode, suffix, suffixFirst: false };
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
