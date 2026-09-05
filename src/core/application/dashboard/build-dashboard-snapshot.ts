import type { DashboardSnapshot } from '../../../components/dashboard/dashboard-snapshot';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';
import type { CurrencyBreakdown } from '../../../components/dashboard/summary-cards';
import type { SerializedCategory } from '../../domain/category';
import type { Movement } from '../../domain/movement';
import { computeDashboardSummary } from '../compute-dashboard-summary';
import { computeCategorySummary } from '../compute-category-summary';
import { computeYearlyEvolution } from '../compute-yearly-evolution';
import { computeContextSummary } from '../compute-context-summary';
import { countsTowardEconomicResult } from '../economic-result';

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

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

  // Filtered movements — scope / accountId / categoryId only. There is NO
  // period/date-range filter anymore (N2, Fase 5 pre-beta audit): every
  // dashboard component uses a FIXED window over this set —
  //   • cards / category rows / financing / recentMovements / contextSummary
  //     → the current CIVIL month only (`monthlyMovements` below);
  //   • the 6-month chart (`monthlyData`) → the full real series ending in
  //     the current civil month;
  //   • the 12-month chart (`yearlyData`) → the full real series of the
  //     current civil year.
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

  // N2: clip the scope/account/category-filtered set to the current civil
  // month for every current-month component. Same civil-date semantics as
  // `filterMovementsByPeriod('current_month', civilNow)` in
  // movement-period-filter.ts (Date.UTC keys + tzOffsetMinutes shift) — the
  // movements page keeps its own period/range filters untouched.
  const currentMonthKey = utcMonthKey(civilNow);
  const monthlyMovements = filteredMovements.filter(
    (m) => utcMonthKey(m.date) === currentMonthKey,
  );

  // Account balances — narrowed to the selected account when applicable.
  const accountBalances =
    filters.accountId !== 'all'
      ? accounts.filter((a) => a.id === filters.accountId)
      : accounts;

  // Multi-currency breakdown for SummaryCards. Balances come from every
  // account; income/expenses are the CURRENT-MONTH economic flows
  // (mirrors the cards: "Ingresos este mes" / "Gastos este mes").
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

  for (const m of monthlyMovements) {
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

  // Aggregation currency scope: the selected account's currency when one is
  // active, else the primary (first) account's currency.
  const currency =
    filters.accountId !== 'all'
      ? accounts.find((a) => a.id === filters.accountId)?.currency ?? primaryCurrency
      : primaryCurrency;

  // N1: Personal/Business split — only when no context filter is active, over
  // the CURRENT-MONTH set and the same civil clock as the total cards. The
  // split is now multi-currency: computeContextSummary aggregates by
  // context × currency (no single-currency scope).
  const contextSummary =
    filters.scope === 'all'
      ? computeContextSummary({
          movements: monthlyMovements,
          now: civilNow,
        })
      : undefined;

  // N2: the aggregators run over the FULL filtered set (charts carry the real
  // multi-month series); `monthlyIncome`/`monthlyExpenses`/`financing*` only
  // count the current-civil-month key, so the cards stay current-month even
  // though the 6-month buckets hold real data for every window month.
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

  // Category rows are current-month fixtures (render alongside the cards).
  // Multi-currency (R4-A2): aggregated per currency, no single-currency scope.
  const { incomeCategories, expenseCategories, incomeTotals, expenseTotals } =
    computeCategorySummary({ movements: monthlyMovements });

  const incomeRows = incomeCategories.map((c) => ({
    label: resolveCategoryLabel(c.categoryId),
    value: c.amount,
    currency: c.currency,
  }));

  const expenseRows = expenseCategories.map((c) => ({
    label: resolveCategoryLabel(c.categoryId),
    value: c.amount,
    currency: c.currency,
  }));

  const yearly = computeYearlyEvolution({
    movements: filteredMovements,
    currency,
    now: civilNow,
  });

  // A11: per-currency chart series — ADDITIVE to the single-currency path.
  // `monthlyData`/`yearlyData` keep today's values; the map is populated only
  // when more than one currency has economic data so mono-currency snapshots
  // behave exactly as before. The primary `currency` is always included so the
  // client's initial selection is always a valid option.
  const economicCurrencies = new Set<string>([currency]);
  for (const m of filteredMovements) {
    if (countsTowardEconomicResult(m)) economicCurrencies.add(m.amount.currency);
  }
  const distinctCurrencies = Array.from(economicCurrencies).sort((a, b) =>
    a === 'COP' ? -1 : b === 'COP' ? 1 : a.localeCompare(b),
  );

  let chartCurrencies: string[] | undefined;
  let chartDataByCurrency: DashboardSnapshot['chartDataByCurrency'];
  if (distinctCurrencies.length > 1) {
    chartCurrencies = distinctCurrencies;
    chartDataByCurrency = {};
    for (const c of distinctCurrencies) {
      chartDataByCurrency[c] = {
        monthly: computeDashboardSummary({
          movements: filteredMovements,
          currency: c,
          now: civilNow,
        }).months,
        yearly: computeYearlyEvolution({
          movements: filteredMovements,
          currency: c,
          now: civilNow,
        }).months,
      };
    }
  }

  // N2: recent movements stay scoped to the current civil month (consistent
  // with the cards above), NOT the unfiltered set.
  const recentMovements = monthlyMovements.slice(0, 5).map((m) => ({
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
    incomeTotals,
    expenseTotals,
    monthlyData,
    yearlyData: yearly.months,
    recentMovements,
    contextSummary,
    chartCurrencies,
    chartDataByCurrency,
  };
}
