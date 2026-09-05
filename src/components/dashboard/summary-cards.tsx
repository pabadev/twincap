'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, User, Briefcase } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';
import type { ContextSummary } from '../../core/application/compute-context-summary';

export interface CurrencyBreakdown {
  currency: string;
  balance: number;
  income: number;
  expenses: number;
}

interface SummaryCardsProps {
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Financing capital inflow of the current month, in `currency` minor units. */
  financingInflow: number;
  /** Financing capital outflow of the current month, in `currency` minor units. */
  financingOutflow: number;
  locale: string;
  currencyBreakdown?: CurrencyBreakdown[];
  /** Personal/Business split (A6) — rendered below the total cards when present. */
  contextSummary?: ContextSummary;
}

function MultiCurrencyValue({
  items,
  field,
  sign,
  locale,
  className,
}: {
  items: CurrencyBreakdown[];
  field: 'balance' | 'income' | 'expenses';
  sign?: string;
  locale: string;
  className?: string;
}) {
  const total = items.reduce((sum, i) => sum + i[field], 0);
  if (items.length <= 1) {
    return (
      <p className={`text-base sm:text-lg font-semibold leading-tight ${className ?? ''}`}>
        {sign}{formatAmount(total, items[0]?.currency ?? 'COP', locale)}
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const val = item[field];
        if (val === 0) return null;
        return (
          <span key={item.currency} className={`text-xs sm:text-sm font-medium leading-tight ${className ?? ''}`}>
            {sign}{formatAmount(val, item.currency, locale)}
          </span>
        );
      })}
    </div>
  );
}

export function SummaryCards({
  currency,
  monthlyIncome,
  monthlyExpenses,
  financingInflow,
  financingOutflow,
  locale,
  currencyBreakdown,
  contextSummary,
}: SummaryCardsProps) {
  const t = useT('Dashboard');
  const multi = currencyBreakdown && currencyBreakdown.length > 1;
  // A11: the cross-currency `totalBalance` sum is gone. In mono-currency mode
  // the single currency's balance IS the total (the sum of every account
  // balance, all in that currency); multi-currency renders the per-currency
  // breakdown instead. No cross-currency arithmetic anywhere.
  const monoBalance =
    currencyBreakdown && currencyBreakdown.length > 0
      ? currencyBreakdown[0].balance
      : 0;
  const balanceClass =
    monoBalance < 0 ? 'text-expense' : 'text-zinc-900 dark:text-zinc-100';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-income/10 p-2">
              <Icon icon={TrendingUp} size="md" className="text-income" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('incomeThisMonth')}</p>
              {multi ? (
                <MultiCurrencyValue items={currencyBreakdown!} field="income" sign="+" locale={locale} className="text-income" />
              ) : (
                <p className="text-base sm:text-lg font-semibold text-income leading-tight">
                  +{formatAmount(monthlyIncome, currency, locale)}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-expense/10 p-2">
              <Icon icon={TrendingDown} size="md" className="text-expense" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('expensesThisMonth')}</p>
              {multi ? (
                <MultiCurrencyValue items={currencyBreakdown!} field="expenses" sign="−" locale={locale} className="text-expense" />
              ) : (
                <p className="text-base sm:text-lg font-semibold text-expense leading-tight">
                  −{formatAmount(monthlyExpenses, currency, locale)}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-info/10 p-2">
              <Icon icon={Wallet} size="md" className="text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('totalBalance')}</p>
              {multi ? (
                <MultiCurrencyValue items={currencyBreakdown!} field="balance" locale={locale} className="text-zinc-900 dark:text-zinc-100" />
              ) : (
                <p className={`text-base sm:text-lg font-semibold leading-tight ${balanceClass}`}>
                  {formatAmount(monoBalance, currency, locale)}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-info/10 p-2">
              <Icon icon={ArrowLeftRight} size="md" className="text-info" />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('financingThisMonth')}</p>
              <p className="text-[11px] sm:text-xs leading-tight text-income">
                {t('financingReceived')}:{' '}
                <span className="font-semibold">+{formatAmount(financingInflow, currency, locale)}</span>
              </p>
              <p className="text-[11px] sm:text-xs leading-tight text-expense">
                {t('financingGranted')}:{' '}
                <span className="font-semibold">−{formatAmount(financingOutflow, currency, locale)}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* A6: Personal / Business split of the current-month result — shown only
          while no context filter is active (scope 'all', server-populated). */}
      {(contextSummary?.personal || contextSummary?.business) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contextSummary.personal && (
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
                <div className="shrink-0 rounded-lg bg-income/10 p-2">
                  <Icon icon={User} size="md" className="text-income" />
                </div>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('filterScopePersonal')}</p>
                  <p className="text-[11px] sm:text-xs leading-tight text-income">
                    {t('income')}:{' '}
                    <span className="font-semibold">+{formatAmount(contextSummary.personal.monthlyIncome, currency, locale)}</span>
                  </p>
                  <p className="text-[11px] sm:text-xs leading-tight text-expense">
                    {t('expenses')}:{' '}
                    <span className="font-semibold">−{formatAmount(contextSummary.personal.monthlyExpenses, currency, locale)}</span>
                  </p>
                </div>
              </div>
            </Card>
          )}
          {contextSummary.business && (
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
                <div className="shrink-0 rounded-lg bg-income/10 p-2">
                  <Icon icon={Briefcase} size="md" className="text-income" />
                </div>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('filterScopeBusiness')}</p>
                  <p className="text-[11px] sm:text-xs leading-tight text-income">
                    {t('income')}:{' '}
                    <span className="font-semibold">+{formatAmount(contextSummary.business.monthlyIncome, currency, locale)}</span>
                  </p>
                  <p className="text-[11px] sm:text-xs leading-tight text-expense">
                    {t('expenses')}:{' '}
                    <span className="font-semibold">−{formatAmount(contextSummary.business.monthlyExpenses, currency, locale)}</span>
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
