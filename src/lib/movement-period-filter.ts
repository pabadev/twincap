/**
 * Dashboard period filtering (Fase D, R5).
 *
 * Extracted from `dashboard-content.tsx` so the `current_month` branch — which
 * was a silent no-op (R5.2) — is pure, testable, and consistent with the
 * UTC civil-date convention from Ronda 3 Fase 1 (D1): business dates are
 * midnight-UTC civil dates, so month/year comparisons use UTC getters.
 *
 * "Current period" is defined by the CLIENT's civil date, not the server's
 * UTC clock: pass `tzOffsetMinutes` (`new Date().getTimezoneOffset()`) and the
 * comparison keys are derived from `now` shifted by that offset (the same
 * pattern as `isFutureBusinessDate` in date.ts). Stored business dates keep
 * using raw UTC getters — that asymmetry is the fix (A2: dashboard cards
 * emptied at month-end evenings for UTC-5 because the UTC instant had already
 * rolled to the next month).
 */

export type PeriodFilter = 'current_month' | 'previous_month' | 'this_year';

/** UTC year-month key of a date ("YYYY-MM") — mirrors the bucketing helpers in core/application. */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Filter movements by dashboard period.
 *
 * - `current_month`: same UTC year-month as `now` — fixes the R5.2 bug where
 *   this branch never filtered, so the income/expense summary tables, top
 *   categories and recent movements ignored the period filter.
 * - `previous_month`: the UTC year-month immediately before `now`'s — the
 *   calendar month before the current one (A3, Fase 3 pre-beta audit).
 * - `this_year`: same UTC year as `now` — preserves the previous dashboard
 *   behavior exactly.
 *
 * `now` is injectable for deterministic tests; production uses the real clock.
 * `tzOffsetMinutes` = `new Date().getTimezoneOffset()` (300 for UTC-5, -60 for
 * UTC+1) shifts `now` to the user's civil date before reading its UTC parts;
 * default 0 keeps the existing UTC behavior for callers and tests that do not
 * pass it.
 */
export function filterMovementsByPeriod<T extends { date: Date | string }>(
  movements: readonly T[],
  period: PeriodFilter,
  now: Date = new Date(),
  tzOffsetMinutes = 0,
): T[] {
  const civilNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  if (period === 'current_month') {
    const key = utcMonthKey(civilNow);
    return movements.filter((m) => utcMonthKey(new Date(m.date)) === key);
  }
  if (period === 'previous_month') {
    // Date.UTC rolls December back to January of the previous year correctly.
    const previousKey = utcMonthKey(
      new Date(Date.UTC(civilNow.getUTCFullYear(), civilNow.getUTCMonth() - 1, 1)),
    );
    return movements.filter((m) => utcMonthKey(new Date(m.date)) === previousKey);
  }
  if (period === 'this_year') {
    const year = civilNow.getUTCFullYear();
    return movements.filter((m) => new Date(m.date).getUTCFullYear() === year);
  }
  return [...movements];
}

/**
 * Filter movements by an optional inclusive date range (A3, Fase 3 pre-beta
 * audit). Business dates are midnight-UTC civil dates (D1), so a range bound
 * `'YYYY-MM-DD'` maps to a midnight-UTC instant: `dateFrom` is inclusive from
 * `00:00:00.000Z`, `dateTo` inclusive until `23:59:59.999Z` — the same idiom
 * as the transfers list and the CSV exporters. A missing bound leaves that
 * side open. Returns a copy (same semantics as `filterMovementsByPeriod`).
 */
export function filterMovementsByDateRange<T extends { date: Date | string }>(
  movements: readonly T[],
  dateFrom?: string,
  dateTo?: string,
): T[] {
  if (!dateFrom && !dateTo) return [...movements];
  const fromTime = dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`).getTime()
    : -Infinity;
  const toTime = dateTo
    ? new Date(`${dateTo}T23:59:59.999Z`).getTime()
    : Infinity;
  // Defensive: a malformed bound would yield NaN and silently drop everything.
  const from = Number.isNaN(fromTime) ? -Infinity : fromTime;
  const to = Number.isNaN(toTime) ? Infinity : toTime;
  return movements.filter((m) => {
    const t = new Date(m.date).getTime();
    return t >= from && t <= to;
  });
}
