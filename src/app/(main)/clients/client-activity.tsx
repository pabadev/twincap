"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";
import type { SerializedSale } from "../../../core/domain/sale";
import type { SerializedCreditGranted } from "../../../core/domain/credit-granted";
import { useLocale, useT } from "../../../i18n/client";
import { formatAmount, formatDate } from "../../../lib/format";
import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { MovementCard } from "../../../components/ui/movement-card";
import { SaleDetailModal } from "../pos/sales/sale-detail-modal";

export function ClientActivity({
  sales,
  credits,
}: {
  sales: SerializedSale[];
  credits: SerializedCreditGranted[];
}) {
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const t = useT("Clients");
  const tSales = useT("Sales");
  const tCredits = useT("CreditsGranted");
  const locale = useLocale();
  const creditBySaleId = useMemo(
    () =>
      new Map(credits.filter((credit) => credit.saleId).map((credit) => [credit.saleId!, credit])),
    [credits],
  );

  return (
    <>
      <SaleDetailModal saleId={detailSaleId} onClose={() => setDetailSaleId(null)} />

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
