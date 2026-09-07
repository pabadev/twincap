/**
 * Pure helper that computes the date window [from, to) for the dashboard
 * snapshot query. The window is the UNION of:
 *   - the current civil year (Jan 1 → next Jan 1), and
 *   - a 6-month sliding window (month-5 → next month after current).
 *
 * `from` = min(yearStart, sixMonthsStart), `to` = exclusive start of the
 * next civil month. Movements at exactly `to` are excluded ($lt).
 *
 * Pure: no I/O, deterministic for given inputs.
 */
export interface DashboardWindow {
  /** Inclusive lower bound (Date). Movements with date >= from are included. */
  from: Date;
  /** Exclusive upper bound (Date). Movements with date < to are included. */
  to: Date;
}

/**
 * Compute the dashboard date window.
 *
 * @param now       The current real-world instant (usually `new Date()`).
 * @param tzOffsetMinutes  Client's `getTimezoneOffset()` (positive for
 *                  west-of-UTC, e.g. 300 for UTC-5). Same semantics as
 *                  `buildDashboardSnapshot` (A2 civil-clock shift).
 *                  Default 0 = server UTC clock.
 */
export function computeDashboardWindow(
  now: Date,
  tzOffsetMinutes = 0,
): DashboardWindow {
  // A2: same civil-clock shift as buildDashboardSnapshot.
  const civilNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);

  const year = civilNow.getUTCFullYear();
  const month = civilNow.getUTCMonth(); // 0-indexed

  const yearStart = Date.UTC(year, 0, 1);
  // Date.UTC handles negative months across year boundaries.
  const sixMonthsStart = Date.UTC(year, month - 5, 1);

  const from = new Date(Math.min(yearStart, sixMonthsStart));
  // Exclusive: start of the next civil month.
  const to = new Date(Date.UTC(year, month + 1, 1));

  return { from, to };
}
