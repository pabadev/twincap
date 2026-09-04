import type { DashboardSnapshot } from '../../../components/dashboard/dashboard-snapshot';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';
import type { CurrencyBreakdown } from '../../../components/dashboard/summary-cards';
import type { SerializedCategory } from '../../domain/category';
import type { Movement } from '../../domain/movement';
import { computeDashboardSummary } from '../compute-dashboard-summary';
import { computeCategorySummary } from '../compute-category-summary';
import { computeYearlyEvolution } from '../compute-yearly-evolution';
import { countsTowardEconomicResult } from '../economic-result';
import { filterMovementsByPeriod } from '../../../lib/movement-period-filter';

/**
 * Inputs for building the aggregate dashboard snapshot.
 *
 * `movements` must already be filtered to live parents (the caller applies
 * `filterMovementsWithLiveParents`); `balance` on each account is whatever
 * the caller computed via `accountBalancesFromMovements` or 0 when none.
 * Pure — no I/O: label resolution and locale are injected.
 */
export interface BuildDashboardSnapshotInput {
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
    isFixed: boolean;
    balance: number;
  }>;
  categories: SerializedCategory[];
  movements: Movement[];
  filters: DashboardFilters;
  locale: string;
  /** Currency used when no single account is selected — `accounts[0]?.currency ?? 'COP'`. */
  primaryCurrency: string;
  /** Resolves a category id to its display label (real, synthetic, or fallback). */
  resolveCategoryLabel: (categoryId: string) => string;
  /**
   * `new Date().getTimezoneOffset()` of the requesting client (300 for UTC-5).
   * Used to derive ONE canonical civil "now" shared by every current-period
   * computation (A2) so the dashboard does not roll to the next month/year
   * early for west-of-UTC timezones. Default 0 = server's UTC clock.
   */
  tzOffsetMinutes?: number;
}

/**
 * Build the aggregate dashboard snapshot for a given filter set.
 *
 * This is the single source of truth for the dashboard's filtered numbers,
 * reused both on the initial page load and inside the `getDashboardSnapshotAction`
 * server action. It deliberately runs the existing pure aggregators
 * (`computeDashboardSummary`, `computeCategorySummary`, `computeYearlyEvolution`)
 * — never a raw Mongo pipeline — so the financial figures cannot diverge from
 * the authoritative use cases.
 */
export function buildDashboardSnapshot(
  input: BuildDashboardSnapshotInput,
): DashboardSnapshot {
  const {
    accounts,
    movements,
    filters,
    primaryCurrency,
    resolveCategoryLabel,
  } = input;

  // A2: ONE canonical "civil now" (the client's calendar date) shared by every
  // current-period computation below — same shift as isFutureBusinessDate.
  const civilNow = new Date(
    Date.now() - (input.tzOffsetMinutes ?? 0) * 60_000,
  );

  // Filtered movements — scope / accountId / categoryId + period
  // (mirrors dashboard-content.tsx :105-125).
  let filteredMovements = movements;

  if (filters.scope !== 'all') {
    filteredMovements = filteredMovements.filter(
      (m) => m.context === filters.scope,
    );
  }

  if (filters.accountId !== 'all') {
    filteredMovements = filteredMovements.filter(
      (m) => m.accountId === filters.accountId,
    );
  }

  if (filters.categoryId !== 'all') {
    filteredMovements = filteredMovements.filter(
      (m) => m.categoryId === filters.categoryId,
    );
  }

  if (filters.period === 'current_month' || filters.period === 'this_year') {
    filteredMovements = filterMovementsByPeriod(
      filteredMovements,
      filters.period,
      civilNow,
    );
  }

  // Account balances — narrowed to the selected account when applicable.
  const accountBalances =
    filters.accountId !== 'all'
      ? accounts.filter((a) => a.id === filters.accountId)
      : accounts;

  // Multi-currency breakdown for SummaryCards (mirrors :135-156).
  const byCurrency = new Map<
    string,
    { balance: number; income: number; expenses: number }
  >();

  for (const a of accountBalances) {
    const entry = byCurrency.get(a.currency) ?? {
      balance: 0,
      income: 0,
      expenses: 0,
    };
    entry.balance += a.balance;
    byCurrency.set(a.currency, entry);
  }

  for (const m of filteredMovements) {
    if (!countsTowardEconomicResult(m)) continue;
    const cur = m.amount.currency;
    const entry = byCurrency.get(cur) ?? {
      balance: 0,
      income: 0,
      expenses: 0,
    };
    if (m.type === 'income') entry.income += m.amount.amount;
    else entry.expenses += m.amount.amount;
    byCurrency.set(cur, entry);
  }

  const currencyBreakdown: CurrencyBreakdown[] = Array.from(byCurrency.entries())
    .map(([currency, data]) => ({ currency, ...data }))
    .sort((a, b) =>
      a.currency === 'COP' ? -1 : b.currency === 'COP' ? 1 : a.currency.localeCompare(b.currency),
    );

  // Aggregation currency scope (mirrors :158-164).
  const currency =
    filters.accountId !== 'all'
      ? accounts.find((a) => a.id === filters.accountId)?.currency ?? primaryCurrency
      : primaryCurrency;

  const {
    monthlyIncome,
    monthlyExpenses,
    financingInflow,
    financingOutflow,
    months: monthlyData,
  } = computeDashboardSummary({
    movements: filteredMovements,
    currency,
    now: civilNow,
  });

  const { incomeCategories, expenseCategories, totalIncome, totalExpenses } =
    computeCategorySummary({ movements: filteredMovements, currency });

  const incomeRows = incomeCategories.map((c) => ({
    label: resolveCategoryLabel(c.categoryId),
    value: c.amount,
  }));

  const expenseRows = expenseCategories.map((c) => ({
    label: resolveCategoryLabel(c.categoryId),
    value: c.amount,
  }));

  const yearly = computeYearlyEvolution({
    movements: filteredMovements,
    currency,
    now: civilNow,
  });

  const recentMovements = filteredMovements.slice(0, 5).map((m) => ({
    id: m.id,
    type: m.type as 'income' | 'expense',
    amount: m.amount.amount,
    currency: m.amount.currency,
    date:
      typeof m.date === 'string'
        ? m.date
        : new Date(m.date).toISOString(),
    categoryName: resolveCategoryLabel(m.categoryId),
  }));

  return {
    filters,
    currency,
    accountBalances,
    currencyBreakdown,
    monthlyIncome,
    monthlyExpenses,
    financingInflow,
    financingOutflow,
    incomeRows,
    expenseRows,
    totalIncome,
    totalExpenses,
    monthlyData,
    yearlyData: yearly.months,
    recentMovements,
  };
}
