'use client';

import { useState, useMemo } from 'react';
import {
  type DashboardFilters,
  DashboardFilterBar,
} from './dashboard-filters';
import { SummaryCards } from './summary-cards';
import { MonthlyChart } from './monthly-chart';
import {
  RecentMovements,
  type SerializedMovement,
} from './recent-movements';
import { PositionCards } from './position-cards';
import { Card } from '../ui/card';
import { computeDashboardSummary } from '../../core/application/compute-dashboard-summary';
import { computeYearlyEvolution } from '../../core/application/compute-yearly-evolution';
import { syntheticCategoryLabel } from '../../lib/synthetic-category-label';
import { formatAmount } from '../../lib/format';
import { useT } from '../../i18n/client';
import type { Category } from '../../core/domain/category';
import type { TranslateFn } from '../../lib/system-note';
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
  categories: Category[];
  primaryCurrency: string;
  locale: string;
  userLabel: string;
  noAccountsMessage: string;
  noMovementsMessage: string;
  tSystemNotes: TranslateFn;
  yearlyData: { month: string; income: number; expenses: number }[];
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
  noAccountsMessage,
  noMovementsMessage,
  tSystemNotes,
  yearlyData,
  positionData,
}: DashboardContentProps) {
  const t = useT('Dashboard');

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
    const realCats = categories.map((c) => ({ value: c.id, label: c.name }));
    const synthCats = [
      'synthetic:credit',
      'synthetic:credit-granted',
      'synthetic:transfer',
      'synthetic:sale',
      'synthetic:opening',
      'synthetic:payable',
    ].map((id) => ({
      value: id,
      label: syntheticCategoryLabel(id, tSystemNotes) ?? id,
    }));
    return [...synthCats, ...realCats];
  }, [categories, tSystemNotes]);

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

  const { months: computedYearly } = useMemo(
    () =>
      computeYearlyEvolution({
        movements: allMovements as any,
        currency,
      }),
    [allMovements, currency],
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
          categoryName:
            categoryOptions.find((c) => c.value === m.categoryId)?.label ?? '',
        })),
    [filteredMovements, categoryOptions],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {userLabel}
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
        locale={locale}
      />

      <PositionCards positions={positionData} locale={locale} />

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accountBalances.map((account) => (
              <Card key={account.id} title={account.name}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    {account.currency}
                  </span>
                  <span className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {formatAmount(account.balance, account.currency, locale)}
                  </span>
                  {account.isFixed && (
                    <span className="mt-1 inline-block w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {t('fixed')}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
