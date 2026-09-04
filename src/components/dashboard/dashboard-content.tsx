'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DashboardFilterBar } from './dashboard-filters';
import { SummaryCards } from './summary-cards';
import { MonthlyChart } from './monthly-chart';
import { RecentMovements } from './recent-movements';
import { PositionCards } from './position-cards';
import { DashboardReportsGrid } from './dashboard-reports-grid';
import { SummaryTable } from './summary-table';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Wallet } from 'lucide-react';
import { isSyntheticCategoryId } from '../../core/domain/synthetic-categories';
import { formatAmount } from '../../lib/format';
import { useT } from '../../i18n/client';
import type { SerializedCategory } from '../../core/domain/category';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { getDashboardSnapshotAction } from '../../app/(main)/dashboard/actions';

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
  const t = useT('Dashboard');

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot);
  const [chartView, setChartView] = useState<'monthly' | 'yearly'>('monthly');
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

  function handleFiltersChange(next: DashboardSnapshot['filters']) {
    startTransition(async () => {
      // A2: the server does not know the client's timezone — send the
      // offset so current-month/current-year derive from the civil date,
      // not the server's UTC clock.
      const nextSnapshot = await getDashboardSnapshotAction(
        next,
        new Date().getTimezoneOffset(),
      );
      setSnapshot(nextSnapshot);
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
    totalIncome,
    totalExpenses,
    monthlyData,
    yearlyData,
    recentMovements,
  } = snapshot;

  const totalBalance = accountBalances.reduce((sum, a) => sum + a.balance, 0);
  const topIncomeRows = incomeRows.slice(0, 3);
  const topExpenseRows = expenseRows.slice(0, 3);

  const chartTitle = chartView === 'monthly' ? undefined : t('yearlyTrend');
  const chartData = chartView === 'monthly' ? monthlyData : yearlyData;

  const greeting = userName
    ? t('welcomeUser', { name: userName })
    : userLabel;

  // R5-E onboarding: shown only while the user still has just the seeded
  // fixed Cash account — uses the FULL account list (not the filtered
  // snapshot balances) so the banner reflects account count regardless of
  // the active dashboard filters.
  const showOnboarding =
    accounts.length === 1 && accounts[0].isFixed;

  return (
    <div className="space-y-8" aria-busy={isPending}>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {greeting}
        </h1>
      </div>

      {showOnboarding && (
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Icon icon={Wallet} size="md" className="text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t('onboardingTitle')}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {t('onboardingBody')}
                </p>
              </div>
            </div>
            <Link href="/accounts" className="shrink-0">
              <Button variant="primary" size="sm">
                {t('onboardingCta')}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <DashboardFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        accounts={accountOptions}
        categories={categoryOptions}
      />

      <SummaryCards
        totalBalance={totalBalance}
        currency={currency}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        financingInflow={financingInflow}
        financingOutflow={financingOutflow}
        locale={locale}
        currencyBreakdown={currencyBreakdown}
      />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t('accounts')}
        </h2>

        {accountBalances.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {noAccountsMessage}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {accountBalances.map((account) => (
              <Card key={account.id} title={account.name}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    {account.currency}
                  </span>
                  <span
                    className={`text-xl font-semibold ${
                      account.balance < 0
                        ? 'text-expense'
                        : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {formatAmount(account.balance, account.currency, locale)}
                  </span>
                  {account.isFixed && (
                    <span className="mt-1 inline-block w-fit rounded-full bg-surface-border px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {t('fixed')}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DashboardReportsGrid />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t('incomeExpenseSummary')}
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SummaryTable
            title={t('incomeSummary')}
            rows={incomeRows}
            total={totalIncome}
            currency={currency}
            locale={locale}
            emptyMessage={t('noIncomeData')}
          />
          <SummaryTable
            title={t('expenseSummary')}
            rows={expenseRows}
            total={totalExpenses}
            currency={currency}
            locale={locale}
            emptyMessage={t('noExpenseData')}
          />
        </div>
      </div>

      {(topIncomeRows.length > 0 || topExpenseRows.length > 0) && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {t('topCategories')}
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {topIncomeRows.length > 0 && (
              <SummaryTable
                title={t('topIncome')}
                rows={topIncomeRows}
                total={topIncomeRows.reduce((s, r) => s + r.value, 0)}
                currency={currency}
                locale={locale}
                emptyMessage={t('noIncomeData')}
              />
            )}
            {topExpenseRows.length > 0 && (
              <SummaryTable
                title={t('topExpense')}
                rows={topExpenseRows}
                total={topExpenseRows.reduce((s, r) => s + r.value, 0)}
                currency={currency}
                locale={locale}
                emptyMessage={t('noExpenseData')}
              />
            )}
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setChartView('monthly')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chartView === 'monthly'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t('viewMonthly')}
          </button>
          <button
            onClick={() => setChartView('yearly')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chartView === 'yearly'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t('viewYearly')}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MonthlyChart
            data={chartData}
            currency={currency}
            locale={locale}
            title={chartTitle}
          />
          <RecentMovements
            movements={recentMovements}
            noMovementsMessage={noMovementsMessage}
          />
        </div>
      </div>

      <PositionCards positions={positionData} locale={locale} />
    </div>
  );
}
