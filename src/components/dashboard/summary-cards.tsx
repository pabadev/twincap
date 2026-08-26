'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Wallet, Scale } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

export interface CurrencyBreakdown {
  currency: string;
  balance: number;
  income: number;
  expenses: number;
}

interface SummaryCardsProps {
  totalBalance: number;
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  netPosition: number;
  locale: string;
  currencyBreakdown?: CurrencyBreakdown[];
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
  totalBalance,
  currency,
  monthlyIncome,
  monthlyExpenses,
  netPosition,
  locale,
  currencyBreakdown,
}: SummaryCardsProps) {
  const t = useT('Dashboard');
  const multi = currencyBreakdown && currencyBreakdown.length > 1;

  return (
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
              <p className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                {formatAmount(totalBalance, currency, locale)}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
          <div className="shrink-0 rounded-lg bg-info/10 p-2">
            <Icon icon={Scale} size="md" className="text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('netPosition')}</p>
            <p className={`text-base sm:text-lg font-semibold leading-tight ${netPosition >= 0 ? 'text-income' : 'text-expense'}`}>
              {netPosition >= 0 ? '+' : ''}{formatAmount(netPosition, currency, locale)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
