"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Eye } from "lucide-react";
import type { SerializedSale } from "../../../core/domain/sale";
import type { SerializedCreditGranted } from "../../../core/domain/credit-granted";
import { useLocale, useT } from "../../../i18n/client";
import { formatAmount, formatDate } from "../../../lib/format";
import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { MovementCard } from "../../../components/ui/movement-card";
import { SaleDetailModal } from "../pos/sales/sale-detail-modal";
import { Button } from "../../../components/ui/button";
import { buildClientStatementPdf, type ClientStatementSale } from "./client-statement-pdf";

export function ClientActivity({
  clientId,
  sales,
  credits,
}: {
  clientId: string;
  sales: SerializedSale[];
  credits: SerializedCreditGranted[];
}) {
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const t = useT("Clients");
  const tSales = useT("Sales");
  const tCredits = useT("CreditsGranted");
  const locale = useLocale();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState(false);
  const creditBySaleId = useMemo(
    () =>
      new Map(credits.filter((credit) => credit.saleId).map((credit) => [credit.saleId!, credit])),
    [credits],
  );

  async function downloadStatement() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setReportError(true);
      return;
    }
    setReportError(false);
    setReportBusy(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const query = params.toString();
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/statement${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("statement_unavailable");
      const data = (await response.json()) as {
        clientName: string;
        sales: ClientStatementSale[];
      };
      buildClientStatementPdf({
        clientName: data.clientName,
        sales: data.sales,
        locale,
        from: dateFrom,
        to: dateTo,
        labels: {
          title: t("statementTitle"),
          generated: t("statementGenerated"),
          period: t("statementPeriod"),
          sale: t("statementSale"),
          total: tSales("total"),
          payment: t("statementPayment"),
          pending: tSales("pending"),
          noActivity: t("statementEmpty"),
          paymentsNote: t("statementPaymentsNote"),
          totals: t("statementTotals"),
        },
      }).save(`twincap-client-statement-${clientId.slice(-8)}.pdf`);
    } catch {
      setReportError(true);
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <>
      <SaleDetailModal saleId={detailSaleId} onClose={() => setDetailSaleId(null)} />

      <section className="mb-8 rounded-xl border border-surface-border bg-surface-card p-4 dark:bg-surface-card">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white">
          {t("statementTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("statementFrom")}
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 text-sm dark:bg-surface-card dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("statementTo")}
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 text-sm dark:bg-surface-card dark:text-white"
            />
          </label>
          <Button variant="secondary" loading={reportBusy} onClick={downloadStatement}>
            <Download className="mr-2 h-4 w-4" />
            {t("statementDownload")}
          </Button>
        </div>
        {reportError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {dateFrom && dateTo && dateFrom > dateTo
              ? t("statementInvalidRange")
              : t("statementLoadError")}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {t("statementPaymentsNote")}
        </p>
      </section>

      <section aria-labelledby="client-sales-heading">
        <h2
          id="client-sales-heading"
          className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          {t("salesHistory")}
        </h2>
        {sales.length === 0 ? (
          <EmptyState title={t("noSalesHistory")} />
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => {
              const currency = sale.items[0]?.unitPrice.currency;
              if (!currency) {
                throw new Error(`Sale ${sale.id} has no resolvable currency in its item snapshot`);
              }
              const linkedCredit = creditBySaleId.get(sale.id);
              return (
                <MovementCard
                  key={sale.id}
                  id={sale.id}
                  fields={[
                    { key: "date", label: tSales("date"), value: formatDate(sale.date, locale) },
                    {
                      key: "total",
                      label: tSales("total"),
                      value: formatAmount(sale.total, currency, locale),
                      primary: true,
                    },
                    {
                      key: "status",
                      label: tSales("status"),
                      value:
                        sale.paymentMode === "paid-in-full"
                          ? tSales("paidInFull")
                          : tSales("onCredit"),
                    },
                    {
                      key: "items",
                      label: tSales("lineItems"),
                      value: String(sale.items.length),
                    },
                    ...(sale.paymentMode === "on-credit"
                      ? [
                          {
                            key: "pending",
                            label: tSales("pending"),
                            value: formatAmount(
                              linkedCredit?.pending ?? sale.pending,
                              currency,
                              locale,
                            ),
                          },
                        ]
                      : []),
                  ]}
                  actions={
                    <>
                      <ActionIconButton
                        icon={Eye}
                        label={t("viewSale")}
                        tone="primary"
                        onClick={() => setDetailSaleId(sale.id)}
                      />
                      {linkedCredit && (
                        <Link
                          href={`/credits/granted?highlight=${encodeURIComponent(linkedCredit.id)}`}
                          aria-label={t("viewLinkedCredit")}
                          title={t("viewLinkedCredit")}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Icon icon={ExternalLink} size="sm" />
                        </Link>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {credits.length > 0 && (
        <section aria-labelledby="client-credits-heading" className="mt-8">
          <h2
            id="client-credits-heading"
            className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white"
          >
            {t("creditsHistory")}
          </h2>
          <div className="space-y-3">
            {credits.map((credit) => (
              <MovementCard
                key={credit.id}
                id={credit.id}
                fields={[
                  { key: "counterparty", label: tCredits("debtor"), value: credit.counterparty },
                  { key: "date", label: tCredits("date"), value: formatDate(credit.date, locale) },
                  {
                    key: "principal",
                    label: tCredits("amount"),
                    value: formatAmount(credit.principal.amount, credit.principal.currency, locale),
                    primary: true,
                  },
                  {
                    key: "pending",
                    label: tCredits("pending"),
                    value: formatAmount(credit.pending, credit.principal.currency, locale),
                  },
                ]}
                actions={
                  <Link
                    href={`/credits/granted?highlight=${encodeURIComponent(credit.id)}`}
                    aria-label={t("viewLinkedCredit")}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon icon={ExternalLink} size="sm" />
                  </Link>
                }
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
