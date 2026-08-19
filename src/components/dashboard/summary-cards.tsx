'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

interface SummaryCardsProps {
  totalBalance: number;
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingCredits: number;
  locale: string;
}

export function SummaryCards({
  totalBalance,
  currency,
  monthlyIncome,
  monthlyExpenses,
  pendingCredits,
  locale,
}: SummaryCardsProps) {
  const t = useT('Dashboard');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Icon icon={Wallet} size="md" className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('totalBalance')}</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {formatAmount(totalBalance, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
            <Icon icon={TrendingUp} size="md" className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('incomeThisMonth')}</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              +{formatAmount(monthlyIncome, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <Icon icon={TrendingDown} size="md" className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('expensesThisMonth')}</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              −{formatAmount(monthlyExpenses, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
            <Icon icon={Clock} size="md" className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('pendingCredits')}</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {formatAmount(pendingCredits, currency, locale)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
