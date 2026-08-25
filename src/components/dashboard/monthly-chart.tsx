'use client';

import { Card } from '../ui/card';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
}

interface MonthlyChartProps {
  data: MonthData[];
  currency: string;
  locale: string;
  title?: string;
}

export function MonthlyChart({ data, currency, locale, title }: MonthlyChartProps) {
  const t = useT('Dashboard');
  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expenses)), 1);

  function formatMonth(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
  }

  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title ?? t('monthlyTrend')}
      </h3>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.month} className="flex items-center gap-3">
            <span className="w-8 text-xs text-zinc-500 dark:text-zinc-400">
              {formatMonth(d.month)}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-4 min-w-0 flex-1">
                  <div
                    className="h-full rounded bg-income"
                    style={{ width: `${(d.income / maxValue) * 100}%`, minWidth: d.income > 0 ? '4px' : '0' }}
                  />
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                  {d.income > 0 ? `+${formatAmount(d.income, currency, locale)}` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 min-w-0 flex-1">
                  <div
                    className="h-full rounded bg-expense"
                    style={{ width: `${(d.expenses / maxValue) * 100}%`, minWidth: d.expenses > 0 ? '4px' : '0' }}
                  />
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                  {d.expenses > 0 ? `−${formatAmount(d.expenses, currency, locale)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-income" /> {t('income')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-expense" /> {t('expenses')}
        </span>
      </div>
    </Card>
  );
}
