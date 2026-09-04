import { CURRENCY_EXPONENTS } from '../core/domain/currency';

/**
 * Escapes a single CSV field: fields containing a comma, a double quote, or a
 * line break are wrapped in double quotes and any internal quotes are doubled.
 */
function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Builds a CSV string with a UTF-8 BOM (Excel-friendly) from headers + rows.
 * Lines are joined with `\r\n`. Fields containing `,` `"` `\n` or `\r` are
 * quoted and internal quotes doubled.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(','),
  );
  return `\uFEFF${lines.join('\r\n')}`;
}

/**
 * Converts an integer minor-units amount to a plain decimal string for CSV
 * (e.g. COP 15000 → "15000", USD 12345 → "123.45"). No currency symbol, no
 * locale grouping. Uses CURRENCY_EXPONENTS; falls back to exponent 2 for
 * unknown currencies. Decimals are fixed to the exponent.
 */
export function minorUnitsToDecimal(amount: number, currency: string): string {
  const exponent = (CURRENCY_EXPONENTS as Record<string, number>)[currency] ?? 2;
  return (amount / Math.pow(10, exponent)).toFixed(exponent);
}