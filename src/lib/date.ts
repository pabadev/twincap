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

import { ValidationError } from '../core/domain/errors';

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

/**
 * True when a business date (midnight-UTC encoded civil date) is AFTER the
 * client's current civil date. The client timezone is expressed as
 * `tzOffsetMinutes` = `new Date().getTimezoneOffset()` (minutes east of UTC:
 * 300 for UTC-5, -60 for UTC+1). Decision D8: future business dates are
 * rejected in the UI (`max={toDateInputValue()}`) and in the backend (this
 * helper). The client's own offset is used instead of the server's so the
 * check matches the user's calendar day, not the host's.
 */
export function isFutureBusinessDate(
  date: Date,
  tzOffsetMinutes = 0,
  now: Date = new Date(),
): boolean {
  const clientNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const todayCivilStartUtc = Date.UTC(
    clientNow.getUTCFullYear(),
    clientNow.getUTCMonth(),
    clientNow.getUTCDate(),
  );
  return date.getTime() > todayCivilStartUtc;
}

/**
 * Throws a domain ValidationError when the business date lies in the client's
 * future. Server actions call this after parsing the form date; the error is
 * mapped by `handleActionError` to `error.futureDate`.
 */
export function assertBusinessDateNotFuture(
  date: Date,
  tzOffsetMinutes = 0,
  now: Date = new Date(),
): void {
  if (isFutureBusinessDate(date, tzOffsetMinutes, now)) {
    throw new ValidationError('Future dates are not allowed');
  }
}
