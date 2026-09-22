"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { DashboardFilterBar } from "./dashboard-filters";
import { SummaryCards } from "./summary-cards";
import { SummaryHero } from "./summary-hero";
import { SummaryAttention } from "./summary-attention";
import { MonthlyChart } from "./monthly-chart";
import { RecentMovements } from "./recent-movements";
import { PositionCards } from "./position-cards";
import { SummaryTable, type SummaryTableRow } from "./summary-table";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { TouchTarget } from "../ui/touch-target";
import { Wallet, MessageSquare, SlidersHorizontal } from "lucide-react";
import { isSyntheticCategoryId } from "../../core/domain/synthetic-categories";
import { formatAmount } from "../../lib/format";
import { useT } from "../../i18n/client";
import type { SerializedCategory } from "../../core/domain/category";
import type { CurrencyTotal } from "../../core/application/compute-category-summary";
import type { DashboardSnapshot } from "./dashboard-snapshot";
import { getDashboardSnapshotAction } from "../../app/(main)/dashboard/actions";
import { FeedbackDialog } from "../feedback/feedback-widget";

interface DashboardAccount {
  id: string;
  name: string;
  currency: string;
  isFixed: boolean;
  balance: number;
}

interface DashboardContentProps {
  accounts: DashboardAccount[];
  categories: SerializedCategory[];
  primaryCurrency: string;
  locale: string;
  userLabel: string;
  userName?: string;
  noAccountsMessage: string;
  noMovementsMessage: string;
  positionData: Array<{
    currency: string;
    activos: number;
    pasivos: number;
    net: number;
  }>;
  /** Aggregate server-side snapshot (initial render); never the raw movements. */
  initialSnapshot: DashboardSnapshot;
}

/**
 * Per-currency totals of a row subset (e.g. the Top-3 tables), sorted
 * COP-first. Never sums across currencies — each currency keeps its own line.
 */
function toTotals(rows: SummaryTableRow[]): CurrencyTotal[] {
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.value);
  }
  return Array.from(byCurrency.entries())
    .map(([currency, value]) => ({ currency, value }))
    .filter((t) => t.value !== 0)
    .sort((a, b) =>
      a.currency === "COP" ? -1 : b.currency === "COP" ? 1 : a.currency.localeCompare(b.currency),
    );
}

export function DashboardContent({
  accounts,
  categories,
  locale,
  userLabel,
  userName,
  noAccountsMessage,
  noMovementsMessage,
  positionData,
  initialSnapshot,
}: DashboardContentProps) {
  const t = useT("Dashboard");
  const tFeedback = useT("Feedback");

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot);
  const [chartView, setChartView] = useState<"monthly" | "yearly">("monthly");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Filters live behind a toggle: the N1 hero reacts to them (the server
  // rebuilds currencyBreakdown with the active filters), so the bar must not
  // steal the first viewport. Collapsed by default.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A11: chart currency selection — only meaningful when the snapshot ships
  // `chartCurrencies` (multi-currency); mono-currency renders no selector and
  // this stays equal to the snapshot's aggregation currency.
  const [chartCurrency, setChartCurrency] = useState<string>(initialSnapshot.currency);
  const [isPending, startTransition] = useTransition();

  // A2 (first paint): the server renders the initial snapshot with its own
  // UTC clock, so at month-end evenings (e.g. 21:00 UTC-5 = 02:00 UTC next
  // day) the current-month cards can arrive empty. Rebuild the snapshot on
  // mount with the client's real civil offset. Filter changes already refetch
  // via handleFiltersChange, so this only fills the first-paint gap.
  const mountSyncDone = useRef(false);
  useEffect(() => {
    if (mountSyncDone.current) return;
    mountSyncDone.current = true;
    getDashboardSnapshotAction(snapshot.filters, new Date().getTimezoneOffset())
      .then(setSnapshot)
      .catch(() => {
        // Keep the server-rendered snapshot on failure; refetch paths above
        // recover on the next interaction.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync
  }, []);

  // A4: re-sync the snapshot whenever the server pushes a fresh initialSnapshot
  // prop (after router.refresh() following a create/update/delete via the FAB
  // or elsewhere). useState keeps the first value forever, so the dashboard
  // stayed stale until a filter change. Same content-comparison semantics as
  // R5-B in movements-list: the server reconstructs the aggregate on every
  // render, so compare by CONTENT — identical content means no real data
  // change and the client-side snapshot (A2 tz-corrected) is kept.
  const snapshotRef = useRef<DashboardSnapshot>(initialSnapshot);
  useEffect(() => {
    const incoming = JSON.stringify(initialSnapshot);
    if (incoming === JSON.stringify(snapshotRef.current)) {
      return;
    }
    snapshotRef.current = initialSnapshot;
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
    [accounts],
  );

  const categoryOptions = useMemo(() => {
    return categories
      .filter((c) => !isSyntheticCategoryId(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
  }, [categories]);

  function handleFiltersChange(next: DashboardSnapshot["filters"]) {
    // Traveling-filter contract (UX-5 §4.3): persist filters in the URL so a
    // reload or navigation restores them instead of resetting to 'all'.
    // history.replaceState (NOT router.replace) keeps the URL in sync WITHOUT
    // triggering an App Router navigation — no server re-render, no loading
    // flash, no double refetch. The next hard reload/navigation reads the
    // params in page.tsx.
    const params = new URLSearchParams();
    if (next.scope !== "all") params.set("scope", next.scope);
    if (next.accountId !== "all") params.set("cuenta", next.accountId);
    if (next.categoryId !== "all") params.set("categoria", next.categoryId);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);

    startTransition(async () => {
      // A2: the server does not know the client's timezone — send the
      // offset so current-month/current-year derive from the civil date,
      // not the server's UTC clock.
      try {
        const nextSnapshot = await getDashboardSnapshotAction(next, new Date().getTimezoneOffset());
        setSnapshot(nextSnapshot);
      } catch {
        // Keep the current snapshot on refetch failure; the filters are
        // already persisted in the URL, so the next reload/navigation will
        // restore them from searchParams. Never let a refetch crash the page.
      }
    });
  }

  const {
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
    yearlyData,
    recentMovements,
  } = snapshot;

  // A11: the cross-currency `totalBalance` reduce is GONE — SummaryCards now
  // derives the mono-currency total from `currencyBreakdown` and renders the
  // per-currency breakdown in multi-currency mode (no cross-currency sum).
  // §31 + beta round 2: asymmetric Top per product decision — incomes are
  // heavily concentrated (≤3 categories either way) so Top 3 avoids noise;
  // expenses spread across many categories and benefit from Top 5.
  // UX-RESUMEN-DESIGN.md row 6 amended accordingly (2026-09-22).
  const topIncomeRows = incomeRows.slice(0, 3);
  const topExpenseRows = expenseRows.slice(0, 5);

  // N1 hero: period result of the snapshot's aggregation currency plus
  // per-currency available balances (never summed across currencies, R15.3.1 P1.3).
  const heroEntry = currencyBreakdown.find((c) => c.currency === currency);
  const heroResult = heroEntry?.result ?? 0;
  const availableByCurrency = currencyBreakdown.map((c) => ({
    currency: c.currency,
    balance: c.balance,
  }));

  // Chart currency: the initially selected currency is the snapshot's
  // aggregation currency. After a refetch the selection may no longer exist
  // (filters changed the data) — fall back to the fresh aggregation currency.
  // Value shown in the selector always follows the actual chart data source.
  const effectiveChartCurrency = snapshot.chartCurrencies?.includes(chartCurrency)
    ? chartCurrency
    : snapshot.currency;

  const chartTitle = chartView === "monthly" ? undefined : t("yearlyTrend");
  const chartData = chartView === "monthly" ? monthlyData : yearlyData;
  const chartDataBySelected = snapshot.chartDataByCurrency?.[effectiveChartCurrency];
  const effectiveChartData =
    chartView === "monthly"
      ? (chartDataBySelected?.monthly ?? chartData)
      : (chartDataBySelected?.yearly ?? chartData);

  const greeting = userName ? t("welcomeUser", { name: userName }) : userLabel;

  const activeFilterCount =
    (filters.scope !== "all" ? 1 : 0) +
    (filters.accountId !== "all" ? 1 : 0) +
    (filters.categoryId !== "all" ? 1 : 0);

  // R5-E onboarding: shown only while the user still has just the seeded
  // fixed Cash account — uses the FULL account list (not the filtered
  // snapshot balances) so the banner reflects account count regardless of
  // the active dashboard filters.
  const showOnboarding = accounts.length === 1 && accounts[0].isFixed;

  return (
    <div className="space-y-8" aria-busy={isPending}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{greeting}</h1>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <MessageSquare className="h-4 w-4" />
          {tFeedback("openFeedback")}
        </button>
      </div>

      {/* Onboarding banner — shown only while the user still has just the
          seeded fixed Cash account. */}
      {showOnboarding && (
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Icon icon={Wallet} size="md" className="text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t("onboardingTitle")}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("onboardingBody")}</p>
              </div>
            </div>
            <Link href="/accounts" className="shrink-0">
              <Button variant="primary" size="sm">
                {t("onboardingCta")}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Filters — collapsed behind a toggle so the N1 hero owns the first
          viewport (the hero DOES react to filters: server rebuilds the
          currency breakdown with the active filter set). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="dashboard-filters"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("filters")}
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("filtersActive")}</span>
        )}
      </div>

      {filtersOpen && (
        <div id="dashboard-filters">
          <DashboardFilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            accounts={accountOptions}
            categories={categoryOptions}
          />
        </div>
      )}

      {/* ── N1 HERO ──────────────────────────────────────────────── */}
      <SummaryHero
        result={heroResult}
        currency={currency}
        available={availableByCurrency}
        dataAsOf={snapshot.dataAsOf}
        locale={locale}
      />

      {/* ── N2 DESGLOSE ──────────────────────────────────────────── */}
      <SummaryCards
        currency={currency}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        financingInflow={financingInflow}
        financingOutflow={financingOutflow}
        financingBreakdown={snapshot.financingBreakdown}
        locale={locale}
        currencyBreakdown={currencyBreakdown}
        contextSummary={filters.scope === "all" ? snapshot.contextSummary : undefined}
      />

      {/* Cuentas — justo debajo de las cards de resumen: responden "¿en qué
          cuentas está?", la continuación natural de la Pregunta 1 de la Regla
          de Oro, no el detalle de "¿qué pasó?" (N5). Orden validado en beta:
          hero → cards → cuentas → categorías → evolución → atención → detalle. */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t("accounts")}
        </h2>

        {accountBalances.length === 0 ? (
          <Card>
            {/* H-10 EXCLUSION (UX-10): N1 dashboard minimalism — the compact
                inline Card text is the approved pattern; a full EmptyState
                would fight the dashboard's grid language. See
                openspec/changes/ux-10-implementation/design.md (H-10 Exclusion Register). */}
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {noAccountsMessage}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {accountBalances.map((account) => (
              <Card key={account.id} title={account.name}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    {account.currency}
                  </span>
                  {/* §21: min-w-0 + break-words keep very large balances inside
                      the card (the Card root clips overflow); tabular-nums
                      keeps digits aligned; mobile steps the size down. Never
                      truncate or hide the figure. */}
                  <span
                    className={`min-w-0 break-words text-lg font-semibold tabular-nums sm:text-xl ${
                      account.balance < 0 ? "text-expense" : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {formatAmount(account.balance, account.currency, locale)}
                  </span>
                  {account.isFixed && (
                    <span className="mt-1 inline-block w-fit rounded-full bg-surface-border px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {t("fixed")}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* N5 DETALLE moved up (beta round 3): Movimientos recientes belongs
          right under the accounts cards — "¿dónde está mi dinero?" then
          "¿qué pasó?" — previous round's decision that cluster 8 regressed
          by pushing it below the chart and attention sections. */}
      <RecentMovements movements={recentMovements} noMovementsMessage={noMovementsMessage} />

      {(topIncomeRows.length > 0 || topExpenseRows.length > 0) && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {t("topCategories")}
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {topIncomeRows.length > 0 && (
              <SummaryTable
                title={t("topIncome")}
                rows={topIncomeRows}
                totals={toTotals(topIncomeRows)}
                locale={locale}
                emptyMessage={t("noIncomeData")}
              />
            )}
            {topExpenseRows.length > 0 && (
              <SummaryTable
                title={t("topExpense")}
                rows={topExpenseRows}
                totals={toTotals(topExpenseRows)}
                locale={locale}
                emptyMessage={t("noExpenseData")}
              />
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t("incomeExpenseSummary")}
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SummaryTable
            title={t("incomeSummary")}
            rows={incomeRows}
            totals={incomeTotals}
            locale={locale}
            emptyMessage={t("noIncomeData")}
          />
          <SummaryTable
            title={t("expenseSummary")}
            rows={expenseRows}
            totals={expenseTotals}
            locale={locale}
            emptyMessage={t("noExpenseData")}
          />
        </div>
      </div>

      {/* ── N3 EVOLUCIÓN ─────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setChartView("monthly")}
            aria-pressed={chartView === "monthly"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chartView === "monthly"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <TouchTarget as="span">{t("viewMonthly")}</TouchTarget>
          </button>
          <button
            onClick={() => setChartView("yearly")}
            aria-pressed={chartView === "yearly"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chartView === "yearly"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <TouchTarget as="span">{t("viewYearly")}</TouchTarget>
          </button>
          {snapshot.chartCurrencies && (
            <label className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("chartCurrency")}
              </span>
              <select
                value={effectiveChartCurrency}
                onChange={(e) => setChartCurrency(e.target.value)}
                aria-label={t("chartCurrency")}
                className="h-9 rounded-md border border-surface-border bg-surface-input px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              >
                {snapshot.chartCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <MonthlyChart
          data={effectiveChartData}
          currency={effectiveChartCurrency}
          locale={locale}
          title={chartTitle}
        />
      </div>

      {/* ── N4 ATENCIÓN ──────────────────────────────────────────── */}
      <SummaryAttention
        attentionTotals={snapshot.attentionTotals}
        overduePayables={snapshot.overduePayables}
        locale={locale}
      />

      <PositionCards positions={positionData} locale={locale} />

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
