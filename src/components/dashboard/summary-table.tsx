'use client';

import { formatAmount } from '../../lib/format';
import { useT } from '../../i18n/client';

export interface SummaryTableRow {
  label: string;
  value: number;
}

interface SummaryTableProps {
  title: string;
  rows: SummaryTableRow[];
  total: number;
  currency: string;
  locale: string;
  emptyMessage: string;
}

export function SummaryTable({
  title,
  rows,
  total,
  currency,
  locale,
  emptyMessage,
}: SummaryTableProps) {
  const t = useT('Dashboard');

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card dark:border-surface-border dark:bg-surface-card flex flex-col">
      <div className="border-b border-surface-border px-6 py-3">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white">{title}</h3>
      </div>

      <div className="grid grid-cols-[1fr_auto] border-b border-surface-border bg-surface-header px-6 py-2 text-xs font-medium uppercase text-zinc-500">
        <span>{t('summaryCategory')}</span>
        <span>{t('summaryAmount')}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 max-h-[300px] sm:max-h-[400px]">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
        ) : (
          rows.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="grid grid-cols-[1fr_auto] items-center border-b border-surface-border py-2"
            >
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-4">
                {row.label}
              </span>
              <span className="text-sm font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                {formatAmount(row.value, currency, locale)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] border-t border-surface-border bg-surface-header px-6 py-3 font-semibold">
        <span className="text-sm text-zinc-800 dark:text-white">{t('total')}</span>
        <span className="text-sm text-zinc-900 dark:text-white whitespace-nowrap">
          {formatAmount(total, currency, locale)}
        </span>
      </div>
    </div>
  );
}
