import type { DashboardFilters } from './dashboard-filters';
import type { CurrencyBreakdown } from './summary-cards';
import type { MonthBucket } from '../../core/application/compute-dashboard-summary';
import type { YearMonthBucket } from '../../core/application/compute-yearly-evolution';
import type { ContextSummary } from '../../core/application/compute-context-summary';
import type { SummaryTableRow } from './summary-table';
import type { SerializedMovement } from './recent-movements';

/**
 * Serialized, aggregate view of the dashboard for a given filter set.
 * Produced server-side (initial page load and `getDashboardSnapshotAction`)
 * so the client never receives the full movement list — only this snapshot
 * plus the five most recent movements. Plain-data only, safe across the
 * server→client boundary.
 */
export interface DashboardAccountSnapshot {
  id: string;
  name: string;
  currency: string;
  isFixed: boolean;
  balance: number;
}

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
  totalIncome: number;
  totalExpenses: number;
  monthlyData: MonthBucket[];
  yearlyData: YearMonthBucket[];
  recentMovements: SerializedMovement[];
  /**
   * Personal/Business split of the current-month economic result (A6).
   * Only present when `filters.scope === 'all'`; sections with no economic
   * data are omitted. Never rendered by the total cards.
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
