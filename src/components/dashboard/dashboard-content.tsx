"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { DashboardSecondaryFilters, DashboardScopeTabs } from "./dashboard-filters";
import { SummaryCards } from "./summary-cards";
import { BusinessSummaryBlock } from "./business-summary";
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
import { Download, Wallet, SlidersHorizontal } from "lucide-react";
import { isSyntheticCategoryId } from "../../core/domain/synthetic-categories";
import { formatAmountParts } from "../../lib/format";
import { useT } from "../../i18n/client";
import type { SerializedCategory } from "../../core/domain/category";
import type { CurrencyTotal } from "../../core/application/compute-category-summary";
import type { DashboardSnapshot } from "./dashboard-snapshot";
import { getDashboardSnapshotAction } from "../../app/(main)/dashboard/actions";
import { buildDashboardReportPdf, type BusinessReportRow } from "./dashboard-report-pdf";

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
  /** H-19: the Negocio tab's own civil range (URL-restored or the server's
   * month-to-date proposal; the block refetches itself on change). */
  initialBusinessRange: { from: string; to: string };
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
  initialBusinessRange,
}: DashboardContentProps) {
  const t = useT("Dashboard");
  const tBusiness = useT("BusinessAnalytics");

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot);
  const [chartView, setChartView] = useState<"monthly" | "yearly">("monthly");
  // H-19: the Negocio tab's own civil range — parent-owned; the block reports
  // changes and handleBusinessRangeChange persists + refetches everything.
  const [businessRange, setBusinessRange] = useState(initialBusinessRange);
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
    const normalizedNext =
      next.scope === "Business" && (!next.from || !next.to)
        ? { ...next, from: businessRange.from, to: businessRange.to }
        : next;
    // Traveling-filter contract (UX-5 §4.3): persist filters in the URL so a
    // reload or navigation restores them instead of resetting to 'all'.
    // history.replaceState (NOT router.replace) keeps the URL in sync WITHOUT
    // triggering an App Router navigation — no server re-render, no loading
    // flash, no double refetch. The next hard reload/navigation reads the
    // params in page.tsx.
    const params = new URLSearchParams();
    if (normalizedNext.period === "year") params.set("periodo", normalizedNext.period);
    if (normalizedNext.scope !== "all") params.set("scope", normalizedNext.scope);
    if (normalizedNext.accountId !== "all") params.set("cuenta", normalizedNext.accountId);
    if (normalizedNext.categoryId !== "all") params.set("categoria", normalizedNext.categoryId);
    // H-19: the business window travels with the scope (the Negocio tab's
    // own range; the URL restores it server-side via filtersFromSearchParams).
    if (normalizedNext.scope === "Business" && normalizedNext.from && normalizedNext.to) {
      params.set("desde", normalizedNext.from);
      params.set("hasta", normalizedNext.to);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);

    startTransition(async () => {
      // A2: the server does not know the client's timezone — send the
      // offset so current-month/current-year derive from the civil date,
      // not the server's UTC clock.
      try {
        const nextSnapshot = await getDashboardSnapshotAction(
          normalizedNext,
          new Date().getTimezoneOffset(),
        );
        setSnapshot(nextSnapshot);
      } catch {
        // Keep the current snapshot on refetch failure; the filters are
        // already persisted in the URL, so the next reload/navigation will
        // restore them from searchParams. Never let a refetch crash the page.
      }
    });
  }

  /** H-19: report the Negocio tab's range upward — updates the filters (which
   * triggers the snapshot refetch with the range) AND keeps the URL contract. */
  function handleBusinessRangeChange(next: { from: string; to: string }) {
    setBusinessRange(next);
    handleFiltersChange({ ...filters, scope: "Business", from: next.from, to: next.to });
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
    // §5.1/§6 (pre-beta round): period granularity + comparison + alerts.
    period,
    periodComparison,
    negativeBalanceAlerts,
    atypicalExpenseAlert,
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

  // N1 hero: period result per currency — each currency with economic
  // movement that month carries its own line; never summed cross-currency
  // (beta round 3). Available balances per currency likewise (R15.3.1 P1.3).
  // §5.1: merged previous-period result per currency (server-computed, may
  // be absent for a currency that had no data in either period).
  const heroResults = currencyBreakdown.map((c) => ({
    currency: c.currency,
    result: c.result,
    prevResult: periodComparison?.find((r) => r.currency === c.currency)?.prevResult,
  }));
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
    (filters.period === "year" ? 1 : 0) +
    (filters.scope !== "all" ? 1 : 0) +
    (filters.accountId !== "all" ? 1 : 0) +
    (filters.categoryId !== "all" ? 1 : 0);

  // R5-E onboarding: shown only while the user still has just the seeded
  // fixed Cash account — uses the FULL account list (not the filtered
  // snapshot balances) so the banner reflects account count regardless of
  // the active dashboard filters.
  const showOnboarding = accounts.length === 1 && accounts[0].isFixed;

  async function downloadReport() {
    let businessRows: BusinessReportRow[] = [];
    if (filters.scope === "Business" && filters.from && filters.to) {
      try {
        const response = await fetch(
          `/api/business/result?from=${encodeURIComponent(filters.from)}&to=${encodeURIComponent(filters.to)}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const data = (await response.json()) as { rows?: BusinessReportRow[] };
          businessRows = data.rows ?? [];
        }
      } catch {
        businessRows = [];
      }
    }

    const selectedAccount = accounts.find((account) => account.id === filters.accountId);
    const selectedCategory = categories.find((category) => category.id === filters.categoryId);
    const pdf = buildDashboardReportPdf({
      snapshot,
      locale,
      positionData,
      businessRows,
      accountLabel: selectedAccount
        ? `${selectedAccount.name} (${selectedAccount.currency})`
        : undefined,
      categoryLabel: selectedCategory?.name,
      labels: {
        title: t("reportTitle"),
        generated: t("reportGenerated"),
        scope: t("filterScope"),
        period: t("periodLabel"),
        account: t("filterAccount"),
        category: t("filterCategory"),
        available: t("availableByCurrency"),
        result: t("periodResult"),
        income: t("income"),
        expenses: t("expenses"),
        financing: t("financingThisMonth"),
        received: t("financingReceived"),
        granted: t("financingGranted"),
        incomeCategories: t("incomeSummary"),
        expenseCategories: t("expenseSummary"),
        amount: t("summaryAmount"),
        position: t("position"),
        assets: t("activos"),
        liabilities: t("pasivos"),
        net: t("netPosition"),
        recent: t("recentMovements"),
        date: t("dataAsOf"),
        type: t("income"),
        note: tBusiness("plainLanguageNote"),
        business: tBusiness("summaryTitle"),
        sales: tBusiness("sales"),
        salesCount: tBusiness("salesCount"),
        cost: tBusiness("cost"),
        expensesRecorded: tBusiness("expenses"),
        businessResult: tBusiness("finalResult"),
        collected: tBusiness("collectedFromSales"),
        receivable: tBusiness("toCollect"),
        incomplete: tBusiness("needsCost"),
        all: t("filterScopeAll"),
        personal: t("filterScopePersonal"),
        businessScope: t("filterScopeBusiness"),
        month: t("periodMonth"),
        year: t("periodYear"),
        noFilter: t("filterAccountAll"),
        noData: t("noMovements"),
        notAvailable: tBusiness("notAvailable"),
      },
    });
    pdf.save("twincap-dashboard-report.pdf");
  }

  return (
    <div className="space-y-8" aria-busy={isPending}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{greeting}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={downloadReport}>
            <Download className="mr-2 h-4 w-4" />
            {t("downloadReport")}
          </Button>
          {/* Founder retirement (2026-11-01): /business-analytics is gone —
              the business block lives ONLY in the Negocio tab below. The
              header keeps no link; the sidebar "Resumen del negocio" item
              deep-links to /dashboard?scope=Business. */}
        </div>
      </div>

      {/* ── Scope tabs — always visible (foundador 2026-10-31): same primary
           context as Movements; secondary filters stay behind Filtros ── */}
      <DashboardScopeTabs filters={filters} onFiltersChange={handleFiltersChange} />

      {/* ── Filtros disclosure — founder review (2026-10-31): sits BELOW the
           tabs line (same composition as Movements), out of the header. ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="dashboard-filters"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-surface-card dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-surface-hover"
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
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{t("filtersActive")}</span>
        )}
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

      {/* Secondary filters (period/account/category) — progressive
          disclosure behind Filtros; the scope is NOT here (tabs above). */}
      {filtersOpen && (
        <div id="dashboard-filters">
          <DashboardSecondaryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            accounts={accountOptions}
            categories={categoryOptions}
          />
        </div>
      )}

      {/* ── N1 HERO ──────────────────────────────────────────────── */}
      <SummaryHero
        results={heroResults}
        available={availableByCurrency}
        dataAsOf={snapshot.dataAsOf}
        locale={locale}
        period={period}
      />

      {/* ── N2 DESGLOSE ──────────────────────────────────────────── */}
      <SummaryCards
        currency={currency}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        period={period}
        periodComparison={periodComparison ?? undefined}
        financingInflow={financingInflow}
        financingOutflow={financingOutflow}
        financingBreakdown={snapshot.financingBreakdown}
        locale={locale}
        currencyBreakdown={currencyBreakdown}
        contextSummary={filters.scope === "all" ? snapshot.contextSummary : undefined}
      />

      {/* ── H-19: BUSINESS BLOCK — only on the Negocio tab. PARENT-CONTROLLED:
           the block reports the selected range and the whole snapshot
           refetches with it (one range per tab — tables, tops, recent,
           chart and flow cards all share the window). ── */}
      {filters.scope === "Business" && (
        <BusinessSummaryBlock
          locale={locale}
          range={businessRange}
          onRangeChange={handleBusinessRangeChange}
        />
      )}

      {/* Cuentas — justo debajo de las cards de resumen: responden "¿en qué
          cuentas está?", la continuación natural de la Pregunta 1 de la Regla
          de Oro, no el detalle de "¿qué pasó?" (N5). Orden validado en beta:
          hero → cards → cuentas → categorías → evolución → atención → detalle. */}
      {/* H-18: GLOBAL (account balances are context-free — D3-bis) → hidden
          on scoped tabs; the global available figure lives in hero #1. */}
      {filters.scope === "all" && (
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
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                {noAccountsMessage}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {accountBalances.map((account) => {
                const parts = formatAmountParts(account.balance, account.currency, locale);
                return (
                  <Card
                    key={account.id}
                    title={account.name}
                    className="relative"
                    headerClassName="!px-3 !py-2"
                    contentClassName="p-3"
                  >
                    {account.isFixed && (
                      <span className="absolute right-3 top-3 z-10 inline-block rounded-full border border-zinc-200 bg-surface-card px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-surface-card dark:text-zinc-400">
                        {t("fixed")}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        {account.currency}
                      </span>
                      {/* §21 + A2 (F4): min-w-0 + break-words keep very large
                        balances inside the card (the Card root clips overflow);
                        tabular-nums keeps digits aligned; the currency suffix
                        is in its own whitespace-nowrap span so it never wraps
                        alone. Mobile steps the size down. */}
                      <span
                        className={`min-h-[3.5rem] min-w-0 break-words text-lg font-semibold tabular-nums sm:min-h-0 sm:text-xl ${
                          account.balance < 0 ? "text-expense" : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {parts.sign}
                        {parts.suffixFirst ? (
                          <>
                            <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>{" "}
                            <span>{parts.amount}</span>
                          </>
                        ) : (
                          <>
                            <span>{parts.amount}</span>{" "}
                            <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* N5 DETALLE moved up (beta round 3): Movimientos recientes belongs
          right under the accounts cards — "¿dónde está mi dinero?" then
          "¿qué pasó?" — previous round's decision that cluster 8 regressed
          by pushing it below the chart and attention sections. */}
      <RecentMovements movements={recentMovements} noMovementsMessage={noMovementsMessage} />

      {/* Top tables — H-20 (fundador 2026-10-31): hidden ONLY on the Negocio
          tab (few business categories made them repeat the summary tables);
          they stay on Todo and Personal. */}
      {filters.scope !== "Business" && (topIncomeRows.length > 0 || topExpenseRows.length > 0) && (
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

      {/* ── N3 EVOLUCIÓN ───────────────────────────────────────────
          FOUNDER REVIEW (2026-10-31): the chart REACTS to the filters and is
          relevant in EVERY scope — it renders in Todo, Personal AND Negocio
          (in the business window its monthly series is bounded by the tab's
          own range). It was wrongly hidden on scoped tabs. */}
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
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t("chartCurrency")}
              </span>
              <select
                value={effectiveChartCurrency}
                onChange={(e) => setChartCurrency(e.target.value)}
                aria-label={t("chartCurrency")}
                className="h-9 rounded-md border border-surface-border bg-surface-input px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
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

      {/* ── N4 ATENCIÓN ──────────────────────────────────────────── H-18:
          the attention rows derive from RAW credit/payable entities (not the
          filtered movement set), so they are scope-invariant → hidden on
          scoped tabs, same criterion as the position summary. */}
      {filters.scope === "all" && (
        <SummaryAttention
          attentionTotals={snapshot.attentionTotals}
          overduePayables={snapshot.overduePayables}
          negativeBalanceAlerts={negativeBalanceAlerts}
          atypicalExpenseAlert={atypicalExpenseAlert}
          locale={locale}
        />
      )}

      {/* H-18 (fundador 2026-10-31): scoped tabs (Personal/Negocio) hide the
          NON-context-reactive global blocks — the position summary is derived
          from account balances (D3-bis: accounts carry no context), so it
          would read as duplicated/incoherent data inside a scoped tab. The
          global available figure already lives in hero #1. Same criterion
          applied below to the accounts grid and the historical chart. */}
      {filters.scope === "all" && <PositionCards positions={positionData} locale={locale} />}
    </div>
  );
}
