'use client';

import { useT } from '../../i18n/client';
import { formatAmount, formatDate } from '../../lib/format';
import { Card } from '../ui/card';

interface SummaryHeroProps {
  /** Period result (income − expenses) in `currency` minor units. */
  result: number;
  /** Aggregation currency of the result figure. */
  currency: string;
  /** Balances per currency (never summed across currencies). */
  available: Array<{ currency: string; balance: number }>;
  /** Data-as-of civil date of the snapshot cut (ISO string). */
  dataAsOf: string;
  locale: string;
}

/**
 * N1 hero (UX-5): period result + available-by-currency + data-as-of.
 *
 * The result is the server-computed `currencyBreakdown[].result` of the
 * snapshot's aggregation currency — the frontend never recomputes it. The
 * available pane lists one line per currency (no cross-currency sum, R15.3.1
 * P1.3). Semantic color only on the result figure (green ≥ 0, red < 0),
 * always with an explicit +/− sign.
 */
export function SummaryHero({
  result,
  currency,
  available,
  dataAsOf,
  locale,
}: SummaryHeroProps) {
  const t = useT('Dashboard');
  const sign = result >= 0 ? '+' : '−';
  const resultColor = result >= 0 ? 'text-income' : 'text-expense';
  const hasData = available.length > 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('periodResult')}
          </p>
          {hasData ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p
                className={`font-display text-[28px] leading-tight md:text-4xl ${resultColor}`}
              >
                {sign}
                {formatAmount(Math.abs(result), currency, locale)}
              </p>
              {/* Variation vs previous period — not shipped by the snapshot
                  yet; stays '—' until the server computes it (UX-5, DEC-R-07). */}
              <span className="inline-flex items-center rounded-full bg-surface-border px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                —
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t('periodResultEmpty')}
            </p>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('availableByCurrency')}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {available.map((a) => (
              <div
                key={a.currency}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {a.currency}
                </span>
                <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {formatAmount(a.balance, a.currency, locale)}
                </span>
              </div>
            ))}
            {available.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">—</p>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        {t('dataAsOf', { date: formatDate(dataAsOf, locale) })}
      </p>
    </div>
  );
}