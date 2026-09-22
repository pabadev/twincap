"use client";

import { useT } from "../../i18n/client";
import { formatAmount, formatDate } from "../../lib/format";
import { Card } from "../ui/card";

interface SummaryHeroProps {
  /**
   * Period result (income − expenses) per currency — server-computed
   * `currencyBreakdown[].result` rows (beta round 3: every currency with
   * movements that month gets its own line; never summed cross-currency).
   */
  results: Array<{ currency: string; result: number }>;
  /** Balances per currency (never summed across currencies). */
  available: Array<{ currency: string; balance: number }>;
  /** Data-as-of civil date of the snapshot cut (ISO string). */
  dataAsOf: string;
  locale: string;
}

/**
 * N1 hero (UX-5): available-by-currency + period result per currency + data-as-of.
 *
 * Both figures are server-computed (`currencyBreakdown` rows) — the frontend
 * never recomputes or sums across currencies (R15.3.1 P1.3). Beta round 3
 * hierarchy: "¿Cuánto tengo disponible?" is the visually dominant card
 * (display font, larger figures); "Flujo de caja del mes" is secondary —
 * same row rhythm and level, smaller figures, per-currency lines, semantic
 * color per row (green ≥ 0, red < 0, explicit sign).
 */
export function SummaryHero({ results, available, dataAsOf, locale }: SummaryHeroProps) {
  const t = useT("Dashboard");
  const hasData = available.length > 0;
  const resultRows = results.filter((r) => r.result !== 0);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card contentClassName="p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          {t("availableByCurrency")}
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {available.map((a) => (
            <div key={a.currency} className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                {a.currency}
              </span>
              {/* §21: min-w-0 + break-words wrap extremely large balances
                  instead of overflowing the card; tabular-nums keeps digits
                  aligned. The figure is never truncated or hidden. */}
              <span className="min-w-0 break-words text-right font-display text-2xl font-semibold tabular-nums text-zinc-900 md:text-3xl dark:text-zinc-100">
                {formatAmount(a.balance, a.currency, locale)}
              </span>
            </div>
          ))}
          {available.length === 0 && (
            // H-10 EXCLUSION (UX-10): N1 dashboard minimalism — the bare "—"
            // is the intentional zero-dash typography of the hero, not a
            // missing state. See openspec/changes/ux-10-implementation/design.md.
            <p className="text-sm text-zinc-600 dark:text-zinc-400">—</p>
          )}
        </div>
      </Card>

      <Card contentClassName="p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          {t("monthlyCashFlow")}
        </p>
        {hasData ? (
          <div className="mt-3 flex flex-col gap-1">
            {resultRows.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("periodResultEmpty")}</p>
            ) : (
              resultRows.map((r) => (
                <div key={r.currency} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                    {r.currency}
                  </span>
                  <span
                    className={`min-w-0 break-words text-right text-lg font-semibold tabular-nums sm:text-xl ${
                      r.result >= 0 ? "text-income" : "text-expense"
                    }`}
                  >
                    {r.result >= 0 ? "+" : "−"}
                    {formatAmount(Math.abs(r.result), r.currency, locale)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("periodResultEmpty")}</p>
        )}
      </Card>

      <p className="text-xs text-zinc-600 dark:text-zinc-400 md:col-span-2">
        {t("dataAsOf", { date: formatDate(dataAsOf, locale) })}
      </p>
    </div>
  );
}
