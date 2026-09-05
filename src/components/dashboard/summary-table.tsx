'use client';

import { formatAmount } from '../../lib/format';
import { useT } from '../../i18n/client';
import type { CurrencyTotal } from '../../core/application/compute-category-summary';

export interface SummaryTableRow {
  label: string;
  value: number;
  currency: string;
}

interface SummaryTableProps {
  title: string;
  rows: SummaryTableRow[];
  /** Per-currency totals, sorted COP-first server-side/client-side. */
  totals: CurrencyTotal[];
  locale: string;
  emptyMessage: string;
}

export function SummaryTable({
  title,
  rows,
  totals,
  locale,
  emptyMessage,
}: SummaryTableProps) {
  const t = useT('Dashboard');

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card dark:border-surface-border dark:bg-surface-card flex flex-col">
      <div className="border-b border-surface-border bg-surface-header dark:bg-zinc-800 px-6 py-3">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white">{title}</h3>
      </div>

      <div className="grid grid-cols-[1fr_auto] border-b border-surface-border bg-surface-header dark:bg-zinc-800 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
        <span>{t('summaryCategory')}</span>
        <span>{t('summaryAmount')}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 max-h-[300px] sm:max-h-[400px]">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
        ) : (
          rows.map((row, i) => (
            <div
              key={`${row.label}-${row.currency}-${i}`}
              className="grid grid-cols-[1fr_auto] items-center border-b border-surface-border py-2"
            >
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-4">
                {row.label}
              </span>
              <span className="text-sm font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                {formatAmount(row.value, row.currency, locale)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer: mono-currency keeps the historical single line; multi-currency
          renders each currency's total on its own line (never summed across
          currencies — same pattern as MultiCurrencyValue in summary-cards). */}
      <div className="grid grid-cols-[1fr_auto] border-t border-surface-border bg-surface-header dark:bg-zinc-800 px-6 py-3 font-semibold">
        <span className="text-sm text-zinc-800 dark:text-white">{t('total')}</span>
        {totals.length === 0 ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">—</span>
        ) : totals.length === 1 ? (
          <span className="text-sm text-zinc-900 dark:text-white whitespace-nowrap">
            {formatAmount(totals[0].value, totals[0].currency, locale)}
          </span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            {totals.map((tl) => (
              <span
                key={tl.currency}
                className="text-sm font-semibold text-zinc-900 dark:text-white whitespace-nowrap"
              >
                {formatAmount(tl.value, tl.currency, locale)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}