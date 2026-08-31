import type { DashboardFilters } from './dashboard-filters';
import type { CurrencyBreakdown } from './summary-cards';
import type { MonthBucket } from '../../core/application/compute-dashboard-summary';
import type { YearMonthBucket } from '../../core/application/compute-yearly-evolution';
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
}
