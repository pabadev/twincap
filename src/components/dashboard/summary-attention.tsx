"use client";

import Link from "next/link";
import { TriangleAlert, Info } from "lucide-react";
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
  /** §7.1: accounts with a negative balance (server-derived, period-free). */
  negativeBalanceAlerts: Array<{
    accountName: string;
    currency: string;
    balance: number;
  }>;
  /** §7.2: confident atypical-expense detection (null = no misleading alert). */
  atypicalExpenseAlert: {
    currency: string;
    current: number;
    reference: number;
    monthsWithData: number;
    ratio: number;
  } | null;
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
  negativeBalanceAlerts,
  atypicalExpenseAlert,
  locale,
}: SummaryAttentionProps) {
  const t = useT("Dashboard");

  const receivablesRows = attentionTotals.filter((r) => r.receivables > 0);
  const payablesRows = attentionTotals.filter((p) => p.payables > 0);
  const hasContent =
    receivablesRows.length > 0 ||
    payablesRows.length > 0 ||
    overduePayables.length > 0 ||
    negativeBalanceAlerts.length > 0 ||
    atypicalExpenseAlert !== null;

  // §7.2 presentation: ratio formatted explicitly (1 decimal) so the rule's
  // numbers are visible and judgeable — statistical simple, no "IA".
  const avgText = atypicalExpenseAlert
    ? (Math.round(atypicalExpenseAlert.ratio * 10) / 10).toFixed(1).replace(".", ",")
    : "";

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">{t("attention")}</h2>

      {!hasContent && (
        <Card contentClassName="p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("attentionEmpty")}</p>
        </Card>
      )}

      {/* §7.1: negative-balance info cards — informativo, sin alarma
              (mandato §7.1): explica qué ocurre, señala la cuenta/moneda y
              permite investigar (enlace a Cuentas). No bloquea nada. */}
      {negativeBalanceAlerts.map((n) => (
        <Card key={`neg-${n.accountName}`} contentClassName="p-4">
          <div className="flex items-center gap-1.5">
            <Icon icon={TriangleAlert} size="sm" className="text-warning" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {t("negativeBalanceTitle")}
            </p>
          </div>
          <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {n.accountName} · {n.currency}
          </p>
          <p className="mt-1 text-sm text-expense" aria-label={t("negativeBalanceDesc")}>
            {formatAmount(n.balance, n.currency, locale)}
          </p>
          <div className="mt-2 flex justify-end">
            <Link href="/accounts" className="text-sm font-medium text-primary hover:underline">
              {t("negativeBalanceReview")}
            </Link>
          </div>
        </Card>
      ))}

      {/* §7.2: atypical expense — regla estadística simple y explicable:
              appears ONLY when ≥ 3 reference months made it confident. */}
      {atypicalExpenseAlert && (
        <Card contentClassName="p-4">
          <div className="flex items-center gap-1.5">
            <Icon icon={Info} size="sm" className="text-info" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {t("atypicalExpenseTitle")}
            </p>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("atypicalExpenseDesc", {
              avg: avgText,
              months: String(atypicalExpenseAlert.monthsWithData),
            })}
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {atypicalExpenseAlert.currency}
            </span>
            <span className="text-sm font-semibold tabular-nums text-expense">
              {formatAmount(atypicalExpenseAlert.current, atypicalExpenseAlert.currency, locale)}
            </span>
          </div>
          <div className="mt-2 flex justify-end">
            <Link href="/movements" className="text-sm font-medium text-primary hover:underline">
              {t("atypicalExpenseReview")}
            </Link>
          </div>
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
