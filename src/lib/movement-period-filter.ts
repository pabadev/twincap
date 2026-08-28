/**
 * Dashboard period filtering (Fase D, R5).
 *
 * Extracted from `dashboard-content.tsx` so the `current_month` branch — which
 * was a silent no-op (R5.2) — is pure, testable, and consistent with the
 * UTC civil-date convention from Ronda 3 Fase 1 (D1): business dates are
 * midnight-UTC civil dates, so month/year comparisons use UTC getters.
 */

export type PeriodFilter = 'current_month' | 'this_year';

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
 * - `this_year`: same UTC year as `now` — preserves the previous dashboard
 *   behavior exactly.
 *
 * `now` is injectable for deterministic tests; production uses the real clock.
 */
export function filterMovementsByPeriod<T extends { date: Date | string }>(
  movements: readonly T[],
  period: PeriodFilter,
  now: Date = new Date(),
): T[] {
  if (period === 'current_month') {
    const key = utcMonthKey(now);
    return movements.filter((m) => utcMonthKey(new Date(m.date)) === key);
  }
  if (period === 'this_year') {
    const year = now.getUTCFullYear();
    return movements.filter((m) => new Date(m.date).getUTCFullYear() === year);
  }
  return [...movements];
}