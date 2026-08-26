'use client';

import { useState, useMemo } from 'react';
import {
  type DashboardFilters,
  DashboardFilterBar,
} from './dashboard-filters';
import { SummaryCards, type CurrencyBreakdown } from './summary-cards';
import { MonthlyChart } from './monthly-chart';
import {
  RecentMovements,
  type SerializedMovement,
} from './recent-movements';
import { PositionCards } from './position-cards';
import { DashboardReportsGrid } from './dashboard-reports-grid';
import { SummaryTable, type SummaryTableRow } from './summary-table';
import { Card } from '../ui/card';
import { computeDashboardSummary } from '../../core/application/compute-dashboard-summary';
import { computeCategorySummary } from '../../core/application/compute-category-summary';
import { computeYearlyEvolution } from '../../core/application/compute-yearly-evolution';
import { isSyntheticCategoryId } from '../../core/domain/synthetic-categories';
import { formatAmount } from '../../lib/format';
import { useT } from '../../i18n/client';
import type { SerializedCategory } from '../../core/domain/category';
import { SYSTEM_NOTES_NAMESPACE } from '../../lib/system-note';
import { syntheticCategoryLabel } from '../../lib/synthetic-category-label';
import type { SerializedMovement as MovementSnapshot } from '../../core/domain/movement';

interface DashboardAccount {
  id: string;
  name: string;
  currency: string;
  isFixed: boolean;
  balance: number;
}

interface DashboardContentProps {
  accounts: DashboardAccount[];
  movements: MovementSnapshot[];
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
}

export function DashboardContent({
  accounts,
  movements: allMovements,
  categories,
  primaryCurrency,
  locale,
  userLabel,
  userName,
  noAccountsMessage,
  noMovementsMessage,
  positionData,
}: DashboardContentProps) {
  const t = useT('Dashboard');
  const tSystemNotes = useT(SYSTEM_NOTES_NAMESPACE);

  const [filters, setFilters] = useState<DashboardFilters>({
    scope: 'all',
    accountId: 'all',
    categoryId: 'all',
    period: 'current_month',
  });
  const [chartView, setChartView] = useState<'monthly' | 'yearly'>('monthly');

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
    [accounts],
  );

  const categoryOptions = useMemo(() => {
    return categories
      .filter((c) => !isSyntheticCategoryId(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
  }, [categories]);

  /** Resolve category label — real categories first, then synthetic fallback. */
  const resolveCategoryLabel = useMemo(() => {
    const realMap = new Map(categoryOptions.map((c) => [c.value, c.label]));
    return (categoryId: string): string => {
      return realMap.get(categoryId)
        ?? syntheticCategoryLabel(categoryId, tSystemNotes)
        ?? t('uncategorized');
    };
  }, [categoryOptions, tSystemNotes, t]);

  const filteredMovements = useMemo(() => {
    let result = allMovements;

    if (filters.scope !== 'all') {
      result = result.filter((m) => m.context === filters.scope);
    }

    if (filters.accountId !== 'all') {
      result = result.filter((m) => m.accountId === filters.accountId);
    }

    if (filters.categoryId !== 'all') {
      result = result.filter((m) => m.categoryId === filters.categoryId);
    }

    if (filters.period === 'this_year') {
      const year = new Date().getUTCFullYear();
      result = result.filter(
        (m) => new Date(m.date).getUTCFullYear() === year,
      );
    }

    return result;
  }, [allMovements, filters]);

  const accountBalances = useMemo(() => {
    if (filters.accountId !== 'all') {
      return accounts.filter((a) => a.id === filters.accountId);
    }
    return accounts;
  }, [accounts, filters.accountId]);

  /** Multi-currency breakdown for SummaryCards. */
  const currencyBreakdown = useMemo((): CurrencyBreakdown[] => {
    const byCurrency = new Map<string, { balance: number; income: number; expenses: number }>();

    for (const a of accountBalances) {
      const entry = byCurrency.get(a.currency) ?? { balance: 0, income: 0, expenses: 0 };
      entry.balance += a.balance;
      byCurrency.set(a.currency, entry);
    }

    for (const m of filteredMovements) {
      const cur = m.amount.currency;
      const entry = byCurrency.get(cur) ?? { balance: 0, income: 0, expenses: 0 };
      if (m.type === 'income') entry.income += m.amount.amount;
      else entry.expenses += m.amount.amount;
      byCurrency.set(cur, entry);
    }

    return Array.from(byCurrency.entries())
      .map(([currency, data]) => ({ currency, ...data }))
      .sort((a, b) => (a.currency === 'COP' ? -1 : b.currency === 'COP' ? 1 : a.currency.localeCompare(b.currency)));
  }, [accountBalances, filteredMovements]);

  const currency = useMemo(() => {
    if (filters.accountId !== 'all') {
      const acc = accounts.find((a) => a.id === filters.accountId);
      return acc?.currency ?? primaryCurrency;
    }
    return primaryCurrency;
  }, [accounts, filters.accountId, primaryCurrency]);

  const totalBalance = useMemo(
    () => accountBalances.reduce((sum, a) => sum + a.balance, 0),
    [accountBalances],
  );

  const { monthlyIncome, monthlyExpenses, months: monthlyData } = useMemo(
    () =>
      computeDashboardSummary({
        movements: filteredMovements as any,
        currency,
      }),
    [filteredMovements, currency],
  );

  const { incomeCategories, expenseCategories, totalIncome, totalExpenses } = useMemo(
    () => computeCategorySummary({ movements: filteredMovements as any, currency }),
    [filteredMovements, currency],
  );

  const incomeRows: SummaryTableRow[] = useMemo(
    () =>
      incomeCategories.map((c) => ({
        label: resolveCategoryLabel(c.categoryId),
        value: c.amount,
      })),
    [incomeCategories, resolveCategoryLabel],
  );

  const expenseRows: SummaryTableRow[] = useMemo(
    () =>
      expenseCategories.map((c) => ({
        label: resolveCategoryLabel(c.categoryId),
        value: c.amount,
      })),
    [expenseCategories, resolveCategoryLabel],
  );

  const topIncomeRows: SummaryTableRow[] = useMemo(
    () => incomeRows.slice(0, 3),
    [incomeRows],
  );

  const topExpenseRows: SummaryTableRow[] = useMemo(
    () => expenseRows.slice(0, 3),
    [expenseRows],
  );

  const { months: computedYearly } = useMemo(
    () =>
      computeYearlyEvolution({
        movements: filteredMovements as any,
        currency,
      }),
    [filteredMovements, currency],
  );

  const netPosition = useMemo(
    () => positionData.reduce((sum, p) => sum + p.net, 0),
    [positionData],
  );

  const chartTitle = chartView === 'monthly' ? undefined : t('yearlyTrend');
  const chartData = chartView === 'monthly' ? monthlyData : computedYearly;

  const recentMovements: SerializedMovement[] = useMemo(
    () =>
      filteredMovements
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          type: m.type as 'income' | 'expense',
          amount: m.amount.amount,
          currency: m.amount.currency,
          date: typeof m.date === 'string' ? m.date : new Date(m.date).toISOString(),
          categoryName: resolveCategoryLabel(m.categoryId),
        })),
    [filteredMovements, resolveCategoryLabel],
  );

  const greeting = userName
    ? t('welcomeUser', { name: userName })
    : userLabel;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {greeting}
        </h1>
      </div>

      <DashboardFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        accounts={accountOptions}
        categories={categoryOptions}
      />

      <SummaryCards
        totalBalance={totalBalance}
        currency={currency}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        netPosition={netPosition}
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
                  <span className="text-xl font-semibold text-zinc-900 dark:text-white">
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
