"use client";

import { useState } from "react";
import { useT, useLocale } from "../../../i18n/client";
import type { SerializedAccount } from "../../../core/domain/account";
import type { SerializedTransfer } from "../../../core/domain/transfer";
import { TransferForm } from "./transfer-form";
import { DeleteTransferButton } from "./delete-transfer-button";
import { formatAmount, formatDate } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { MovementCard } from "../../../components/ui/movement-card";
import { ArrowRightLeft, Pencil } from "lucide-react";

function accountName(accounts: SerializedAccount[], id: string): string {
  const acc = accounts.find((a) => a.id === id);
  return acc ? `${acc.name} (${acc.currency})` : id;
}

/** Formats the stored effectiveExchangeRate (§11) for display — up to 6
 *  decimals so the inverse convention (e.g. USD→COP 0,00026316) stays
 *  readable and integer rates (3800 COP/USD) keep their shape. */
function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(rate);
}

export function TransfersList({
  accounts,
  transfers,
  defaultCurrency,
}: {
  accounts: SerializedAccount[];
  transfers: SerializedTransfer[];
  /** User's preferred currency for new operations. */
  defaultCurrency?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<SerializedTransfer | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const t = useT("Transfers");
  const tCommon = useT("Common");
  const locale = useLocale();

  const filtered = transfers.filter((transfer) => {
    if (dateFrom && new Date(transfer.date).getTime() < new Date(dateFrom).getTime()) return false;
    if (dateTo && new Date(transfer.date).getTime() > new Date(dateTo + "T23:59:59.999Z").getTime())
      return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <Button variant="primary" size="sm" className="h-11" onClick={() => setShowForm(true)}>
          {t("addTransfer")}
        </Button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("newTransfer")}>
        <TransferForm
          accounts={accounts}
          defaultCurrency={defaultCurrency}
          onSuccess={() => setShowForm(false)}
        />
      </Modal>

      <Modal
        open={!!editingTransfer}
        onClose={() => setEditingTransfer(null)}
        title={t("editTitle")}
      >
        {editingTransfer && (
          <TransferForm
            accounts={accounts}
            transfer={editingTransfer}
            onSuccess={() => setEditingTransfer(null)}
          />
        )}
      </Modal>

      {transfers.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ArrowRightLeft} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <label
                htmlFor="transfers-filter-date-from"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                {t("filterDateFrom")}
              </label>
              <input
                id="transfers-filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="transfers-filter-date-to"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                {t("filterDateTo")}
              </label>
              <input
                id="transfers-filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
          </div>

          {filtered.length === 0 && transfers.length > 0 && (
            <EmptyState title={tCommon("noResults")} />
          )}

          {/* Cards are the only representation (product decision 2026-09-21). */}
          <div className="space-y-3">
            {filtered.map((transfer) => (
              <MovementCard
                key={transfer.id}
                id={transfer.id}
                fields={[
                  {
                    key: "date",
                    label: tCommon("date"),
                    value: formatDate(transfer.date, locale),
                  },
                  {
                    key: "fromTo",
                    label: t("fromTo"),
                    value: `${accountName(accounts, transfer.sourceAccountId)} → ${accountName(accounts, transfer.destinationAccountId)}`,
                  },
                  {
                    key: "amount",
                    label: tCommon("amount"),
                    value: formatAmount(
                      transfer.sourceAmount.amount,
                      transfer.sourceAmount.currency,
                      locale,
                    ),
                    primary: true,
                  },
                  ...(transfer.sourceCurrency !== transfer.destinationCurrency
                    ? [
                        {
                          key: "dest",
                          label: t("destAmount", {
                            currency: transfer.destinationCurrency,
                          }),
                          value: [
                            formatAmount(
                              transfer.destinationAmount.amount,
                              transfer.destinationAmount.currency,
                              locale,
                            ),
                            transfer.effectiveExchangeRate && transfer.effectiveExchangeRate !== 1
                              ? `(${t("effectiveRate")}: ${formatRate(transfer.effectiveExchangeRate, locale)})`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" "),
                        },
                      ]
                    : []),
                  {
                    key: "note",
                    label: tCommon("note"),
                    value: transfer.note || "—",
                  },
                ]}
                actions={
                  <div className="flex items-center gap-1">
                    <ActionIconButton
                      icon={Pencil}
                      label={tCommon("edit")}
                      tone="primary"
                      onClick={() => setEditingTransfer(transfer)}
                    />
                    <DeleteTransferButton transferId={transfer.id} />
                  </div>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
