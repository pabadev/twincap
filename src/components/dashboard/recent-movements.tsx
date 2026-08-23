'use client';

import { Card } from '../ui/card';
import { useT, useLocale } from '../../i18n/client';
import { formatAmount, formatDate } from '../../lib/format';

export interface SerializedMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  categoryName: string;
}

interface RecentMovementsProps {
  movements: SerializedMovement[];
  noMovementsMessage: string;
}

export function RecentMovements({ movements, noMovementsMessage }: RecentMovementsProps) {
  const t = useT('Dashboard');
  const locale = useLocale();

  if (movements.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('recentMovements')}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{noMovementsMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t('recentMovements')}
      </h3>
      <div className="space-y-2">
        {movements.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800"
          >
            <div>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {m.categoryName || t('uncategorized')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(m.date, locale)}
              </p>
            </div>
            <span
              className={`text-sm font-medium ${
                m.type === 'income'
                  ? 'text-income'
                  : 'text-expense'
              }`}
            >
              {m.type === 'income' ? '+' : '−'}
              {formatAmount(m.amount, m.currency, locale)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
