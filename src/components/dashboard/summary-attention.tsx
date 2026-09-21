"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useT } from "../../i18n/client";
import { formatAmount } from "../../lib/format";
import { Card } from "../ui/card";
import { Icon } from "../ui/icon";

export interface SummaryAttentionProps {
  attentionTotals: Array<{
    currency: string;
    receivables: number;
    payables: number;
  }>;
  overduePayables: Array<{
    id: string;
    label: string;
    currency: string;
    pending: number;
    daysOverdue: number;
  }>;
  locale: string;
}

/**
 * N4 attention (UX-5): receivables / payables per currency plus overdue
 * payment alerts (max 3). Empty state ("Nada requiere tu atención") when
 * there is nothing to show — never a wall of alerts (DEC-R-05 / §25).
 */
export function SummaryAttention({
  attentionTotals,
  overduePayables,
  locale,
}: SummaryAttentionProps) {
  const t = useT("Dashboard");

  const receivablesRows = attentionTotals.filter((r) => r.receivables > 0);
  const payablesRows = attentionTotals.filter((p) => p.payables > 0);
  const hasContent =
    receivablesRows.length > 0 || payablesRows.length > 0 || overduePayables.length > 0;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">{t("attention")}</h2>

      {!hasContent && (
        <Card contentClassName="p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("attentionEmpty")}</p>
        </Card>
      )}

      {hasContent && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {receivablesRows.length > 0 && (
            <Card contentClassName="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {t("receivables")}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {receivablesRows.map((r) => (
                  <div key={r.currency} className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{r.currency}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatAmount(r.receivables, r.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {payablesRows.length > 0 && (
            <Card contentClassName="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {t("payables")}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {payablesRows.map((p) => (
                  <div key={p.currency} className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{p.currency}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatAmount(p.payables, p.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {overduePayables.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center gap-1.5">
                <Icon icon={TriangleAlert} size="sm" className="text-warning" />
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  {t("overduePayment")}
                </p>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {p.label}
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("overdueDays", { days: String(p.daysOverdue) })}
                </span>
              </div>
              <div className="mt-2 flex justify-end">
                <Link href="/payables" className="text-sm font-medium text-primary hover:underline">
                  {t("review")}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
