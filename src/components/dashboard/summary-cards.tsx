'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

interface SummaryCardsProps {
  totalBalance: number;
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  locale: string;
}

export function SummaryCards({
  totalBalance,
  currency,
  monthlyIncome,
  monthlyExpenses,
  locale,
}: SummaryCardsProps) {
  const t = useT('Dashboard');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-info/10 p-2">
            <Icon icon={Wallet} size="md" className="text-info" />
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
          <div className="rounded-lg bg-income/10 p-2">
            <Icon icon={TrendingUp} size="md" className="text-income" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('incomeThisMonth')}</p>
            <p className="text-lg font-semibold text-income">
              +{formatAmount(monthlyIncome, currency, locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-expense/10 p-2">
            <Icon icon={TrendingDown} size="md" className="text-expense" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('expensesThisMonth')}</p>
            <p className="text-lg font-semibold text-expense">
              −{formatAmount(monthlyExpenses, currency, locale)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
