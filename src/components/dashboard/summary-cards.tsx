'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Wallet, Scale } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

interface SummaryCardsProps {
  totalBalance: number;
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  netPosition: number;
  locale: string;
}

export function SummaryCards({
  totalBalance,
  currency,
  monthlyIncome,
  monthlyExpenses,
  netPosition,
  locale,
}: SummaryCardsProps) {
  const t = useT('Dashboard');

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
          <div className="shrink-0 rounded-lg bg-income/10 p-2">
            <Icon icon={TrendingUp} size="md" className="text-income" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('incomeThisMonth')}</p>
            <p className="text-base sm:text-lg font-semibold text-income leading-tight">
              +{formatAmount(monthlyIncome, currency, locale)}
            </p>
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
            <p className="text-base sm:text-lg font-semibold text-expense leading-tight">
              −{formatAmount(monthlyExpenses, currency, locale)}
            </p>
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
            <p className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
              {formatAmount(totalBalance, currency, locale)}
            </p>
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
