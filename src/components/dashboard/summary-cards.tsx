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
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="shrink-0 rounded-lg bg-income/10 p-2">
            <Icon icon={TrendingUp} size="md" className="text-income" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('incomeThisMonth')}</p>
            <p className="text-sm sm:text-lg font-semibold text-income truncate">
              +{formatAmount(monthlyIncome, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="shrink-0 rounded-lg bg-expense/10 p-2">
            <Icon icon={TrendingDown} size="md" className="text-expense" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('expensesThisMonth')}</p>
            <p className="text-sm sm:text-lg font-semibold text-expense truncate">
              −{formatAmount(monthlyExpenses, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="shrink-0 rounded-lg bg-info/10 p-2">
            <Icon icon={Wallet} size="md" className="text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('totalBalance')}</p>
            <p className="text-sm sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {formatAmount(totalBalance, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="shrink-0 rounded-lg bg-info/10 p-2">
            <Icon icon={Scale} size="md" className="text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('netPosition')}</p>
            <p className={`text-sm sm:text-lg font-semibold truncate ${netPosition >= 0 ? 'text-income' : 'text-expense'}`}>
              {netPosition >= 0 ? '+' : ''}{formatAmount(netPosition, currency, locale)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
