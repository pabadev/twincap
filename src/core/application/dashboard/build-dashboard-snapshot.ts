import type {
  DashboardSnapshot,
  DashboardFilters,
  CurrencyBreakdown,
  AttentionTotals,
  OverduePayable,
} from "./dashboard-types";
import type { SerializedCategory } from "../../domain/category";
import type { Movement } from "../../domain/movement";
import { computeDashboardSummary } from "../compute-dashboard-summary";
import { computeCategorySummary } from "../compute-category-summary";
import { computeYearlyEvolution } from "../compute-yearly-evolution";
import { computeContextSummary } from "../compute-context-summary";
import { countsTowardEconomicResult } from "../economic-result";
import { sumSafeMinorUnits } from "../../domain/money";

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
  /**
   * Currency used when no single account is selected. The caller resolves it
   * from the first account or falls back to `DEFAULT_CURRENCY` (currency.ts).
   * Never a hardcoded string — the fallback is explicit and traceable.
   */
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
  /** Payable entities for the attention section (pending totals + overdue). */
  payables?: Array<{
    id: string;
    pending: { amount: number; currency: string };
    dueDate?: string | Date;
    description: string;
  }>;
  /** Credit granted entities for receivables (pending, not written off). */
  creditsGranted?: Array<{
    pending: { amount: number; currency: string };
    writtenOff?: boolean;
  }>;
  /** Credit received entities for payables (pending). */
  creditsReceived?: Array<{
    pending: { amount: number; currency: string };
  }>;
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
export function buildDashboardSnapshot(input: BuildDashboardSnapshotInput): DashboardSnapshot {
  const { accounts, movements, filters, primaryCurrency, resolveCategoryLabel } = input;

  // A2: ONE canonical "civil now" (the client's calendar date) shared by every
  // current-period computation below — same shift as isFutureBusinessDate.
  const civilNow = new Date(Date.now() - (input.tzOffsetMinutes ?? 0) * 60_000);

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

  if (filters.scope !== "all") {
    filteredMovements = filteredMovements.filter((m) => m.context === filters.scope);
  }

  if (filters.accountId !== "all") {
    filteredMovements = filteredMovements.filter((m) => m.accountId === filters.accountId);
  }

  if (filters.categoryId !== "all") {
    filteredMovements = filteredMovements.filter((m) => m.categoryId === filters.categoryId);
  }

  // N2: clip the scope/account/category-filtered set to the current civil
  // month for every current-month component. Same civil-date semantics as
  // `filterMovementsByPeriod('current_month', civilNow)` in
  // movement-period-filter.ts (Date.UTC keys + tzOffsetMinutes shift) — the
  // movements page keeps its own period/range filters untouched.
  const currentMonthKey = utcMonthKey(civilNow);
  const monthlyMovements = filteredMovements.filter((m) => utcMonthKey(m.date) === currentMonthKey);

  // Account balances — narrowed to the selected account when applicable.
  const accountBalances =
    filters.accountId !== "all" ? accounts.filter((a) => a.id === filters.accountId) : accounts;

  // Multi-currency breakdown for SummaryCards. Balances come from every
  // account; income/expenses are the CURRENT-MONTH economic flows
  // (mirrors the cards: "Ingresos este mes" / "Gastos este mes").
  const byCurrency = new Map<
    string,
    { balance: number; income: number; expenses: number; result: number }
  >();

  for (const a of accountBalances) {
    const entry = byCurrency.get(a.currency) ?? {
      balance: 0,
      income: 0,
      expenses: 0,
      result: 0,
    };
    // R15.3.1 P1.3: per-currency breakdown sums are guarded the same way as
    // every other monetary aggregation (silent overflow would corrupt the
    // SummaryCards while the account-balance path throws).
    entry.balance = sumSafeMinorUnits(
      [entry.balance, a.balance],
      `Dashboard balance breakdown (${a.currency})`,
    );
    byCurrency.set(a.currency, entry);
  }

  for (const m of monthlyMovements) {
    if (!countsTowardEconomicResult(m)) continue;
    const cur = m.amount.currency;
    const entry = byCurrency.get(cur) ?? {
      balance: 0,
      income: 0,
      expenses: 0,
      result: 0,
    };
    if (m.type === "income") {
      entry.income = sumSafeMinorUnits(
        [entry.income, m.amount.amount],
        `Dashboard income breakdown (${cur})`,
      );
    } else {
      entry.expenses = sumSafeMinorUnits(
        [entry.expenses, m.amount.amount],
        `Dashboard expenses breakdown (${cur})`,
      );
    }
    byCurrency.set(cur, entry);
  }

  // N1: per-currency period result (income − expenses), signed. Presentation
  // only over the same economic buckets the cards already aggregate — the
  // frontend never recomputes it.
  for (const entry of byCurrency.values()) {
    entry.result = entry.income - entry.expenses;
  }

  const currencyBreakdown: CurrencyBreakdown[] = Array.from(byCurrency.entries())
    .map(([currency, data]) => ({ currency, ...data }))
    .sort((a, b) =>
      a.currency === "COP" ? -1 : b.currency === "COP" ? 1 : a.currency.localeCompare(b.currency),
    );

  // Aggregation currency scope: the selected account's currency when one is
  // active, else the primary (first) account's currency.
  const currency =
    filters.accountId !== "all"
      ? (accounts.find((a) => a.id === filters.accountId)?.currency ?? primaryCurrency)
      : primaryCurrency;

  // N1: Personal/Business split — only when no context filter is active, over
  // the CURRENT-MONTH set and the same civil clock as the total cards. The
  // split is now multi-currency: computeContextSummary aggregates by
  // context × currency (no single-currency scope).
  const contextSummary =
    filters.scope === "all"
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
    a === "COP" ? -1 : b === "COP" ? 1 : a.localeCompare(b),
  );

  let chartCurrencies: string[] | undefined;
  let chartDataByCurrency: DashboardSnapshot["chartDataByCurrency"];
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
  // with the cards above), NOT the unfiltered set. UX-5: amplified from 5 to
  // 10 rows for the Resumen N5 detail list.
  const recentMovements = monthlyMovements.slice(0, 10).map((m) => ({
    id: m.id,
    type: m.type as "income" | "expense",
    amount: m.amount.amount,
    currency: m.amount.currency,
    date: typeof m.date === "string" ? m.date : new Date(m.date).toISOString(),
    categoryName: resolveCategoryLabel(m.categoryId),
  }));

  // N4 (UX-5): attention totals per currency — receivables = credits granted
  // pending (not written off); payables = credits received pending + payables
  // pending. Plain per-currency sums over derived pendings, no FX.
  const attentionByCurrency = new Map<string, { receivables: number; payables: number }>();

  for (const cg of input.creditsGranted ?? []) {
    if (cg.writtenOff) continue;
    const cur = cg.pending.currency;
    const entry = attentionByCurrency.get(cur) ?? { receivables: 0, payables: 0 };
    // R15.3.1 P1.3: per-currency attention sums go through sumSafeMinorUnits
    // — same overflow protection as every other monetary aggregation.
    entry.receivables = sumSafeMinorUnits(
      [entry.receivables, cg.pending.amount],
      `Dashboard receivables breakdown (${cur})`,
    );
    attentionByCurrency.set(cur, entry);
  }

  for (const cr of input.creditsReceived ?? []) {
    const cur = cr.pending.currency;
    const entry = attentionByCurrency.get(cur) ?? { receivables: 0, payables: 0 };
    entry.payables = sumSafeMinorUnits(
      [entry.payables, cr.pending.amount],
      `Dashboard payables breakdown (${cur})`,
    );
    attentionByCurrency.set(cur, entry);
  }

  for (const p of input.payables ?? []) {
    const cur = p.pending.currency;
    const entry = attentionByCurrency.get(cur) ?? { receivables: 0, payables: 0 };
    entry.payables = sumSafeMinorUnits(
      [entry.payables, p.pending.amount],
      `Dashboard payables breakdown (${cur})`,
    );
    attentionByCurrency.set(cur, entry);
  }

  const attentionTotals: AttentionTotals[] = Array.from(attentionByCurrency.entries())
    .map(([currency, data]) => ({ currency, ...data }))
    .sort((a, b) =>
      a.currency === "COP" ? -1 : b.currency === "COP" ? 1 : a.currency.localeCompare(b.currency),
    );

  // N4 (UX-5): overdue payables — dueDate before the civil now with pending
  // still open. Oldest first (most days overdue first), max 3.
  const overduePayables: OverduePayable[] = (input.payables ?? [])
    .filter((p) => {
      if (!p.dueDate) return false;
      const due = new Date(p.dueDate);
      return due < civilNow && p.pending.amount > 0;
    })
    .map((p) => ({
      id: p.id,
      label: p.description,
      currency: p.pending.currency,
      pending: p.pending.amount,
      daysOverdue: Math.floor((civilNow.getTime() - new Date(p.dueDate!).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 3);

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
    dataAsOf: civilNow.toISOString(),
    attentionTotals,
    overduePayables,
    contextSummary,
    chartCurrencies,
    chartDataByCurrency,
  };
}
