/**
 * Period comparison for the dashboard (pre-beta round, mandate §5.1).
 *
 * Compares the current civil period against the PREVIOUS period of the SAME
 * duration, per currency — each currency is compared with ITSELF, never
 * summed across currencies (§5.1 multi-moneda). Uses the same economic
 * classification (countsTowardEconomicResult) and guarded sums
 * (sumSafeMinorUnits) as every other dashboard aggregator, so the figures
 * cannot diverge from the authoritative use cases. Pure — no I/O.
 */
import type { Movement } from "../../domain/movement";
import { sumSafeMinorUnits } from "../../domain/money";
import { countsTowardEconomicResult } from "../economic-result";
import {
  dashboardPeriodKeyOf,
  resolveDashboardPeriod,
  type DashboardPeriod,
} from "./dashboard-period";

/** One per-currency comparison row (deltas in minor units; pct only when defined). */
export interface PeriodComparisonRow {
  currency: string;
  income: number;
  expenses: number;
  /** Result of the CURRENT period (income − expenses), signed. */
  result: number;
  prevIncome: number;
  prevExpenses: number;
  prevResult: number;
  incomeDelta: number;
  expenseDelta: number;
  resultDelta: number;
  /**
   * Relative change vs the previous period: (current − prev) / |prev|.
   * `null` when the previous period is 0 for that metric — there is no
   * honest percentage without a comparable base (§5.1: never Infinity/NaN);
   * the UI renders a "sin referencia comparable" placeholder instead.
   */
  incomePct: number | null;
  expensePct: number | null;
  resultPct: number | null;
}

/**
 * Safe relative change: (current − prev) / |prev| when prev != 0, else null.
 * The magnitude is signed by (current − prev) — no formula that mints an
 * absurd financial interpretation when the base is negative.
 */
function changePct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return (current - prev) / Math.abs(prev);
}

/** COP-first stable ordering used by every multi-currency dashboard table. */
function copFirstCompare(a: string, b: string): number {
  if (a === "COP") return -1;
  if (b === "COP") return 1;
  return a.localeCompare(b);
}

/**
 * Per-currency comparison of the current vs previous civil period.
 *
 * @param movements Full filtered movement set (both periods must be inside
 *                  the caller's read window).
 */
export function computePeriodComparison(input: {
  movements: Movement[];
  period: DashboardPeriod;
  /** Civil "now" (already shifted by the caller — A2 civil-clock basis). */
  civilNow: Date;
}): PeriodComparisonRow[] {
  const { movements, period, civilNow } = input;
  const { current: currentKey, prev: prevKey } = resolveDashboardPeriod(period, civilNow);

  const buckets = new Map<
    string,
    { income: number; expenses: number; prevIncome: number; prevExpenses: number }
  >();

  const add = (
    cur: string,
    field: "income" | "expenses" | "prevIncome" | "prevExpenses",
    amount: number,
    label: string,
  ) => {
    const entry = buckets.get(cur) ?? { income: 0, expenses: 0, prevIncome: 0, prevExpenses: 0 };
    entry[field] = sumSafeMinorUnits([entry[field], amount], label);
    buckets.set(cur, entry);
  };

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    const cur = m.amount.currency;
    const key = dashboardPeriodKeyOf(period, m.date);
    if (key !== currentKey && key !== prevKey) continue;
    const field: "income" | "expenses" = m.type === "income" ? "income" : "expenses";
    add(
      cur,
      key === currentKey ? field : field === "income" ? "prevIncome" : "prevExpenses",
      m.amount.amount,
      `Dashboard period comparison (${cur} ${key})`,
    );
  }

  return Array.from(buckets.entries())
    .map(([currency, b]) => {
      const income = b.income;
      const expenses = b.expenses;
      const prevIncome = b.prevIncome;
      const prevExpenses = b.prevExpenses;
      const result = sumSafeMinorUnits(
        [income, -expenses],
        `Dashboard period comparison result (${currency})`,
      );
      const prevResult = sumSafeMinorUnits(
        [prevIncome, -prevExpenses],
        `Dashboard period comparison prev result (${currency})`,
      );
      return {
        currency,
        income,
        expenses,
        result,
        prevIncome,
        prevExpenses,
        prevResult,
        incomeDelta: sumSafeMinorUnits(
          [income, -prevIncome],
          `Dashboard period comparison income delta (${currency})`,
        ),
        expenseDelta: sumSafeMinorUnits(
          [expenses, -prevExpenses],
          `Dashboard period comparison expense delta (${currency})`,
        ),
        resultDelta: sumSafeMinorUnits(
          [result, -prevResult],
          `Dashboard period comparison result delta (${currency})`,
        ),
        incomePct: changePct(income, prevIncome),
        expensePct: changePct(expenses, prevExpenses),
        resultPct: changePct(result, prevResult),
      };
    })
    .sort((a, b) => copFirstCompare(a.currency, b.currency));
}
