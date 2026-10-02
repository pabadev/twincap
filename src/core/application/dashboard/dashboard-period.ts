/**
 * Dashboard period contract (pre-beta round, mandate §5.1 + §6).
 *
 * A dashboard period is a civil-granularity selection: the current civil
 * month or the current civil year. Civil keys use the SAME convention as the
 * existing aggregators (D1: business dates are midnight-UTC civil dates, so
 * UTC parts of the shifted instant are the client's civil parts — A2).
 *
 * Pure: no I/O, deterministic for given inputs.
 */

/** Granularity of the dashboard period selection (§6). */
export type DashboardPeriod = "month" | "year";

/** Current-period key and the comparable previous-period key (same length). */
export interface ResolvedPeriod {
  current: string;
  prev: string;
}

/** UTC year key of a date ("YYYY"). */
function utcYearKey(d: Date): string {
  return String(d.getUTCFullYear());
}

/**
 * Civil key of a date for the given granularity. "month" → "YYYY-MM"
 * (same format as the monthly aggregators), "year" → "YYYY".
 */
export function dashboardPeriodKeyOf(period: DashboardPeriod, d: Date): string {
  return period === "year"
    ? utcYearKey(d)
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Resolve the current and previous period keys for a granularity, anchored
 * on the civil "now" (already shifted by the caller — A2). The previous
 * period has the SAME civil duration: previous calendar month / previous
 * calendar year, derived with Date.UTC arithmetic so December→January and
 * January(→December) wrap naturally.
 */
export function resolveDashboardPeriod(period: DashboardPeriod, civilNow: Date): ResolvedPeriod {
  if (period === "year") {
    const year = civilNow.getUTCFullYear();
    return { current: String(year), prev: String(year - 1) };
  }
  const prevMonthDate = new Date(
    Date.UTC(civilNow.getUTCFullYear(), civilNow.getUTCMonth() - 1, 1),
  );
  return {
    current: dashboardPeriodKeyOf("month", civilNow),
    prev: dashboardPeriodKeyOf("month", prevMonthDate),
  };
}
