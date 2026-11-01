import type { Movement } from "../domain/movement";
import { sumSafeMinorUnits } from "../domain/money";
import { countsTowardEconomicResult, FINANCING_CAPITAL_LINK_KINDS } from "./economic-result";
import { dashboardPeriodKeyOf, type DashboardPeriod } from "./dashboard/dashboard-period";

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
  /**
   * §6: period granularity of the headline totals + financing flows.
   * Default "month" (baseline unchanged); "year" scopes them to the current
   * civil year. The 6-month chart series is unaffected.
   */
  period?: DashboardPeriod;
}): DashboardMonthlySummary {
  const { movements, currency } = input;
  const now = input.now ?? new Date();
  const civilNow = new Date(now.getTime() - (input.tzOffsetMinutes ?? 0) * 60_000);
  const period = input.period ?? "month";
  const currentKey = dashboardPeriodKeyOf(period, civilNow);

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let financingInflow = 0;
  let financingOutflow = 0;
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const m of movements) {
    const financingCapital = m.link !== undefined && FINANCING_CAPITAL_LINK_KINDS.has(m.link.kind);

    if (
      m.amount.currency === currency &&
      financingCapital &&
      dashboardPeriodKeyOf(period, m.date) === currentKey
    ) {
      if (m.type === "income") {
        // R15.3.1 P1.3: guarded sums — every monetary aggregation is
        // bound-checked, including the financing flows that the cards do NOT
        // show (they feed the economic-result gap diagnostics).
        financingInflow = sumSafeMinorUnits(
          [financingInflow, m.amount.amount],
          "Dashboard monthly financing inflow",
        );
      } else {
        financingOutflow = sumSafeMinorUnits(
          [financingOutflow, m.amount.amount],
          "Dashboard monthly financing outflow",
        );
      }
    }

    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;

    const key = utcMonthKey(m.date);

    if (dashboardPeriodKeyOf(period, m.date) === currentKey) {
      if (m.type === "income") {
        monthlyIncome = sumSafeMinorUnits(
          [monthlyIncome, m.amount.amount],
          "Dashboard monthly income",
        );
      } else {
        monthlyExpenses = sumSafeMinorUnits(
          [monthlyExpenses, m.amount.amount],
          "Dashboard monthly expenses",
        );
      }
    }

    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    if (m.type === "income") {
      bucket.income = sumSafeMinorUnits(
        [bucket.income, m.amount.amount],
        "Dashboard monthly income",
      );
    } else {
      bucket.expenses = sumSafeMinorUnits(
        [bucket.expenses, m.amount.amount],
        "Dashboard monthly expenses",
      );
    }
    monthlyMap.set(key, bucket);
  }

  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(civilNow.getUTCFullYear(), civilNow.getUTCMonth() - i, 1));
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

/**
 * H-19 (fundador 2026-10-31): summary of the Negocio tab's OWN civil range.
 * Same aggregation rules as computeDashboardSummary (economic buckets exclude
 * financing capital and internal flows; sumSafeMinorUnits everywhere) but the
 * window is the tab's explicit range [from, toExclusive) and the monthly
 * series covers EVERY month inside it (bounded — no fixed trailing window),
 * so the chart and the headline totals share the exact range the founder
 * selected. One currency per call; never summed cross-currency.
 */
export interface BusinessRangeSummary {
  /** Economic income of the whole range window. */
  income: number;
  /** Economic expenses of the whole range window. */
  expenses: number;
  /** Financing capital inflow (credit received principals) inside the range. */
  financingInflow: number;
  /** Financing capital outflow (credit granted principals) inside the range. */
  financingOutflow: number;
  /** One bucket per month inside [from, to), oldest first. */
  months: MonthBucket[];
}

export function computeBusinessRangeSummary(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /** Inclusive civil range start (midnight-UTC convention, D1). */
  from: Date;
  /** EXCLUSIVE range end (start of the civil day after `to`). */
  toExclusive: Date;
}): BusinessRangeSummary {
  const { movements, currency } = input;
  const fromMs = input.from.getTime();
  const toMs = input.toExclusive.getTime();

  let income = 0;
  let expenses = 0;
  let financingInflow = 0;
  let financingOutflow = 0;
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const m of movements) {
    const epoch = m.date.getTime();
    if (epoch < fromMs || epoch >= toMs) continue;
    if (m.amount.currency !== currency) continue;

    const financingCapital = m.link !== undefined && FINANCING_CAPITAL_LINK_KINDS.has(m.link.kind);

    const monthlyKey = utcMonthKey(m.date);
    // First pass keeps both the range totals and monthly buckets guarded.
    if (financingCapital) {
      if (m.type === "income") {
        financingInflow = sumSafeMinorUnits(
          [financingInflow, m.amount.amount],
          "Business-range financing inflow",
        );
      } else {
        financingOutflow = sumSafeMinorUnits(
          [financingOutflow, m.amount.amount],
          "Business-range financing outflow",
        );
      }
    }

    if (!countsTowardEconomicResult(m)) continue;

    const bucket = monthlyMap.get(monthlyKey) ?? { income: 0, expenses: 0 };
    if (m.type === "income") {
      income = sumSafeMinorUnits([income, m.amount.amount], "Business-range income");
      bucket.income = sumSafeMinorUnits(
        [bucket.income, m.amount.amount],
        "Business-range monthly income",
      );
    } else {
      expenses = sumSafeMinorUnits([expenses, m.amount.amount], "Business-range expenses");
      bucket.expenses = sumSafeMinorUnits(
        [bucket.expenses, m.amount.amount],
        "Business-range monthly expenses",
      );
    }
    monthlyMap.set(monthlyKey, bucket);
  }

  // Bounded series: one bucket per civil month inside the range, oldest first.
  const months: MonthBucket[] = [];
  const cursor = new Date(input.from);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < toMs) {
    const key = utcMonthKey(cursor);
    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    months.push({ month: key, ...bucket });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return { income, expenses, financingInflow, financingOutflow, months };
}
