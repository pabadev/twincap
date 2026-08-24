/**
 * Civil-date helpers (decision D1).
 *
 * Business dates (movements, transfers, credits, sales, payables) are stored
 * as civil dates encoded as midnight UTC (`new Date("YYYY-MM-DD")`). Two
 * distinct operations exist and must never be mixed:
 *
 * - Rendering "now" as the user's calendar date → LOCAL getters
 *   (`toDateInputValue`), because the instant is timezone-dependent.
 * - Decoding a stored business date back to its civil value → UTC getters
 *   (`businessDateToInputValue`), because the stored encoding IS the civil
 *   date. Local getters would shift it ±1 day west of UTC.
 */

/** Local calendar date of an instant, formatted for `<input type="date">`. */
export function toDateInputValue(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Stored business date (midnight-UTC encoded civil date) → its calendar
 * value for `<input type="date">`. Reads UTC parts explicitly; equivalent to
 * the raw `date.toISOString().slice(0, 10)` but named and TZ-proof.
 */
export function businessDateToInputValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
