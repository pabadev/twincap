import type { Movement } from "../domain/movement";
import {
  countsTowardEconomicResult,
  FINANCING_CAPITAL_LINK_KINDS,
} from "./economic-result";

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface MonthBucket {
  /** UTC year-month key ("YYYY-MM") of the bucketed business dates. */
  month: string;
  income: number;
  expenses: number;
}

export interface DashboardMonthlySummary {
  /** Economic income of the current calendar month (excludes internal flows and financing capital). */
  monthlyIncome: number;
  /** Economic expenses of the current calendar month (excludes internal flows and financing capital). */
  monthlyExpenses: number;
  /**
   * Financing capital inflow of the current month — principals of credits
   * received (debt, not income). Zero when there are none.
   */
  financingInflow: number;
  /**
   * Financing capital outflow of the current month — principals of credits
   * granted (assets, not expenses). Zero when there are none.
   */
  financingOutflow: number;
  /** Last 6 calendar months ending with the current one, oldest first. */
  months: MonthBucket[];
}

/**
 * Aggregate dashboard economic-result numbers for ONE currency scope.
 *
 * Pure function over already-loaded movements. Movements classified as
 * financing capital (credit principals) or as internal flows (transfers,
 * opening balances) never reach the income/expense aggregates — decision D2,
 * refined in round 8. The current-month financing capital movements are
 * reported separately as `financingInflow`/`financingOutflow`; every other
 * movement keeps its existing cash-basis treatment: credit abonos
 * (received/granted), sale payments, and payable payments still count.
 *
 * Bucketing groups by the UTC year-month of each stored business date,
 * matching the civil-date storage convention (decision D1). The "current
 * month" and the 6-month window anchor on the client's CIVIL date —
 * `tzOffsetMinutes` shifts `now` before reading its UTC parts (A2), so the
 * window does not roll early for west-of-UTC timezones.
 */
export function computeDashboardSummary(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /** Reference instant for the "current month"; defaults to the real clock. */
  now?: Date;
  /**
   * `new Date().getTimezoneOffset()` of the requesting client (300 for UTC-5,
   * -60 for UTC+1). Shifts `now` to the client's civil date before deriving
   * the current-period keys. Default 0 = UTC (server clock).
   */
  tzOffsetMinutes?: number;
}): DashboardMonthlySummary {
  const { movements, currency } = input;
  const now = input.now ?? new Date();
  const civilNow = new Date(
    now.getTime() - (input.tzOffsetMinutes ?? 0) * 60_000,
  );
  const currentKey = utcMonthKey(civilNow);

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let financingInflow = 0;
  let financingOutflow = 0;
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const m of movements) {
    const financingCapital =
      m.link !== undefined && FINANCING_CAPITAL_LINK_KINDS.has(m.link.kind);

    if (m.amount.currency === currency && financingCapital && utcMonthKey(m.date) === currentKey) {
      if (m.type === 'income') financingInflow += m.amount.amount;
      else financingOutflow += m.amount.amount;
    }

    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;

    const key = utcMonthKey(m.date);

    if (key === currentKey) {
      if (m.type === 'income') monthlyIncome += m.amount.amount;
      else monthlyExpenses += m.amount.amount;
    }

    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') bucket.income += m.amount.amount;
    else bucket.expenses += m.amount.amount;
    monthlyMap.set(key, bucket);
  }

  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      Date.UTC(civilNow.getUTCFullYear(), civilNow.getUTCMonth() - i, 1),
    );
    const key = utcMonthKey(d);
    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    months.push({ month: key, ...bucket });
  }

  return {
    monthlyIncome,
    monthlyExpenses,
    financingInflow,
    financingOutflow,
    months,
  };
}