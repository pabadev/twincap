/**
 * Pure dashboard data types (R14-K §14c).
 *
 * These shapes describe the SERIALIZED dashboard snapshot, its filters and
 * its rendered rows. They moved here from `src/components/dashboard/*` so the
 * snapshot builder (core) never imports components; the component files
 * re-export them from this module for the presentation layer. Plain data
 * only — no React, no client-component imports.
 */

import type { MonthBucket } from '../compute-dashboard-summary';
import type { YearMonthBucket } from '../compute-yearly-evolution';
import type { ContextSummary } from '../compute-context-summary';
import type { CurrencyTotal } from '../compute-category-summary';

/** Dashboard scope filter: all movements or a single context. */
export type ScopeFilter = 'all' | 'Personal' | 'Business';

export interface DashboardFilters {
  scope: ScopeFilter;
  accountId: string;
  categoryId: string;
}

/** Per-currency summary of the balances + current-month income/expenses. */
export interface CurrencyBreakdown {
  currency: string;
  balance: number;
  income: number;
  expenses: number;
}

/** Row of the income/expense category summary tables. */
export interface SummaryTableRow {
  label: string;
  value: number;
  currency: string;
}

/** Serialized recent movement (the five most recent of the current civil month). */
export interface SerializedMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  categoryName: string;
}

/** Per-account snapshot entry (filtered by accountId when applicable). */
export interface DashboardAccountSnapshot {
  id: string;
  name: string;
  currency: string;
  isFixed: boolean;
  balance: number;
}

/**
 * Serialized, aggregate view of the dashboard for a given filter set.
 * Produced server-side (initial page load and `getDashboardSnapshotAction`)
 * so the client never receives the full movement list — only this snapshot
 * plus the five most recent movements. Plain-data only, safe across the
 * server→client boundary.
 */
export interface DashboardSnapshot {
  filters: DashboardFilters;
  currency: string;
  accountBalances: DashboardAccountSnapshot[]; // filtered by accountId when applicable
  currencyBreakdown: CurrencyBreakdown[];
  monthlyIncome: number;
  monthlyExpenses: number;
  financingInflow: number;
  financingOutflow: number;
  incomeRows: SummaryTableRow[];
  expenseRows: SummaryTableRow[];
  /** Per-currency totals of the category summary tables, sorted COP-first. */
  incomeTotals: CurrencyTotal[];
  expenseTotals: CurrencyTotal[];
  monthlyData: MonthBucket[];
  yearlyData: YearMonthBucket[];
  recentMovements: SerializedMovement[];
  /**
   * Personal/Business split of the current-month economic result, per
   * currency (N1, Fase 5 pre-beta audit): each context carries one entry
   * per currency with data, sorted COP-first. Only present when
   * `filters.scope === 'all'`; sections with no economic data are omitted.
   * Never rendered by the total cards.
   */
  contextSummary?: ContextSummary;
  /**
   * Distinct currencies with economic chart data in the filtered set,
   * sorted COP-first (A11). Present ONLY when more than one currency has
   * data — mono-currency snapshots keep the historical single-currency
   * fields and leave this undefined (zero-change behavior).
   */
  chartCurrencies?: string[];
  /**
   * Per-currency monthly/yearly chart series (A11), present alongside
   * `chartCurrencies`. ADDITIVE: `monthlyData`/`yearlyData` keep the
   * single-currency values as today; the map only powers the currency
   * selector in the chart view (no server round-trip on switch).
   */
  chartDataByCurrency?: Record<
    string,
    { monthly: MonthBucket[]; yearly: YearMonthBucket[] }
  >;
}