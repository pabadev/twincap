/**
 * Tolerant money-input parser (beta feedback #13).
 *
 * The old `type="number"` inputs silently reshaped Spanish-style typing:
 * "5.000" (five thousand) became 5 because the browser reads the dot as a
 * decimal separator. Money inputs are now text inputs with `inputMode="decimal"`
 * and every money field is parsed with this single, explicit rule set:
 *
 * - Both "." and "," present → the LAST one is the decimal separator, the
 *   other one is thousands ("1.234,56" and "1,234.56" → 1234.56).
 * - Only "," present → comma is the decimal separator (LatAm convention:
 *   "5000,50" → 5000.5).
 * - Only "." present → a strict thousands-group pattern (`\d{1,3}(\.\d{3})+`)
 *   is thousands ("5.000" → 5000, "1.234.567" → 1234567); anything else
 *   ("5.50", "5.5") is a decimal dot.
 * - Plain digits stay plain ("5000" → 5000) — the historical contract.
 *
 * Returns null for empty/invalid input so callers can fall back to 0 and let
 * the domain's amount>0 validation surface the error (never silently accepted).
 */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  if (!/^[\d.,-]+$/.test(s)) return null;

  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  if (!body) return null;

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");

  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    normalized = body.split(thousandSep).join("").split(decimalSep).join(".");
  } else if (lastComma !== -1) {
    normalized = body.split(",").join(".");
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(body)) {
    normalized = body.split(".").join("");
  } else {
    normalized = body;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
