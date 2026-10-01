"use client";

import { useState } from "react";
import Link from "next/link";
import type { SerializedCatalogItem } from "../../../../../core/domain/catalog";
import type { SerializedAccount } from "../../../../../core/domain/account";
import type { SerializedInventoryReceipt } from "../../../../../core/domain/inventory-receipt";
import { useLocale, useT } from "../../../../../i18n/client";
import { formatAmount } from "../../../../../lib/format";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Icon } from "../../../../../components/ui/icon";
import { Modal } from "../../../../../components/ui/modal";
import { Button } from "../../../../../components/ui/button";
import { MovementCard } from "../../../../../components/ui/movement-card";
import { CalendarDays, Package } from "lucide-react";
import { SearchInput } from "../../../../../components/ui/search-input";
import { InventoryReceiptForm } from "../inventory-receipt-form";
import { CatalogSectionNav } from "../catalog-section-nav";

export function ReceiptHistoryList({
  items,
  accounts,
  receipts,
  payableIds,
  search,
  dateFrom,
  dateTo,
  page,
  totalPages,
  total,
  filterError,
}: {
  items: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  receipts: SerializedInventoryReceipt[];
  payableIds: string[];
  search: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  totalPages: number;
  total: number;
  filterError: boolean;
}) {
  const t = useT("Catalog");
  const tc = useT("Common");
  const locale = useLocale();
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptFormKey, setReceiptFormKey] = useState(0);
  // X-clear founder rule (§15): the GET-form search input becomes a controlled
  // island seeded from the server search param; submit still navigates with
  // the live value via the native form GET.
  const [searchDraft, setSearchDraft] = useState(search);
  const products = items.filter(
    (item) => item.type === "product" && item.comboVersions.length === 0,
  );

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/pos/catalog/receipts?${query}` : "/pos/catalog/receipts";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t("receiptPageTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("receiptPageDescription")}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setReceiptFormKey((current) => current + 1);
            setShowReceipt(true);
          }}
          disabled={products.length === 0}
        >
          {t("receiveSupplies")}
        </Button>
      </div>
      <CatalogSectionNav active="receipts" />

      {accounts.length === 0 && (
        <p className="mb-4 rounded-lg border border-info/30 bg-info/5 p-3 text-sm text-zinc-700 dark:text-zinc-200">
          {t("receiptCreateAccountFirst")}{" "}
          <Link href="/accounts" className="font-medium text-primary hover:underline">
            {t("receiptGoToAccounts")}
          </Link>
        </p>
      )}

      <form
        action="/pos/catalog/receipts"
        method="get"
        className="mb-5 grid gap-3 rounded-xl border border-surface-border bg-surface-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto_auto] lg:items-end"
      >
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("receiptSearchLabel")}
          <div className="mt-1">
            <SearchInput
              ariaLabel={t("receiptSearchPlaceholder")}
              clearLabel={tc("clearSearch")}
              value={searchDraft}
              onValueChange={setSearchDraft}
              inputProps={{ name: "q", maxLength: 100, type: "text" }}
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("receiptFromDate")}
          <input
            name="from"
            type="date"
            max={dateTo || undefined}
            defaultValue={dateFrom}
            className="mt-1 block h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-surface-card dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("receiptToDate")}
          <input
            name="to"
            type="date"
            min={dateFrom || undefined}
            defaultValue={dateTo}
            className="mt-1 block h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-surface-card dark:text-white"
          />
        </label>
        <Button type="submit" variant="secondary">
          {t("receiptApplyFilters")}
        </Button>
        <Link
          href="/pos/catalog/receipts"
          className="inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary dark:text-zinc-300"
        >
          {t("receiptClearFilters")}
        </Link>
      </form>
      {filterError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {t("receiptInvalidFilters")}
        </p>
      )}

      {total === 0 ? (
        <EmptyState
          icon={<Icon icon={search || dateFrom || dateTo ? CalendarDays : Package} size="xl" />}
          title={search || dateFrom || dateTo ? t("receiptNoMatches") : t("receiptEmptyTitle")}
          description={
            search || dateFrom || dateTo
              ? t("receiptNoMatchesDescription")
              : t("receiptEmptyDescription")
          }
          action={
            !search && !dateFrom && !dateTo && products.length > 0 ? (
              <Button variant="primary" onClick={() => setShowReceipt(true)}>
                {t("receiveSupplies")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t("receiptResults", { count: String(total) })}
          </p>
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <MovementCard
                key={receipt.id}
                id={receipt.id}
                fields={[
                  {
                    key: "supplier",
                    label: t("receiptSupplierLabel"),
                    value: receipt.supplierName || t("receiptSupplierUnknown"),
                    primary: true,
                  },
                  {
                    key: "date",
                    label: t("receiptFromDate"),
                    value: `${new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(receipt.date))}${
                      receipt.reference ? ` · ${receipt.reference}` : ""
                    }`,
                  },
                  {
                    key: "total",
                    label: t("receiptTotal"),
                    value: formatAmount(receipt.total.amount, receipt.total.currency, locale),
                    primary: true,
                  },
                  {
                    key: "payment",
                    label: t("receiptPaymentStateLabel"),
                    value: !receipt.payableId
                      ? t("receiptPaidInFullShort")
                      : payableIds.includes(receipt.payableId)
                        ? t("receiptOutstanding")
                        : t("receiptPayableMissing"),
                    className:
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                      (!receipt.payableId
                        ? "bg-success/10 text-success"
                        : payableIds.includes(receipt.payableId)
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-expense/10 text-expense"),
                  },
                ]}
              >
                {/* Line detail:zx the receipt's item breakdown mirrors the
                    sale-detail list — flat rows, name link left, amount right,
                    no nested bordered box (it read as a foreign widget). */}
                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {receipt.lines.map((line, index) => {
                    const item = items.find((entry) => entry.id === line.catalogItemId);
                    const itemHref = item
                      ? `/pos/catalog?highlight=${encodeURIComponent(item.id)}#catalog-item-${encodeURIComponent(item.id)}`
                      : undefined;
                    const quantityLabel = `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(line.quantity)} ${t(`unit_${line.unit}`)}`;
                    const lineLabel = item?.name ?? t("receiptUnknownItem");
                    return (
                      <li
                        key={`${line.catalogItemId}-${index}`}
                        className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                      >
                        {itemHref ? (
                          <Link
                            href={itemHref}
                            className="min-w-0 font-medium text-primary hover:underline"
                          >
                            <span className="truncate">
                              {lineLabel}
                              <span className="text-zinc-500">
                                {" · "}
                                {quantityLabel}
                              </span>
                            </span>
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                            {lineLabel}
                            <span className="text-zinc-500">
                              {" · "}
                              {quantityLabel}
                            </span>
                          </span>
                        )}
                        <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                          {formatAmount(line.lineAmount, receipt.total.currency, locale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {receipt.payableId && payableIds.includes(receipt.payableId) && (
                  <Link
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    href={`/payables?highlight=${encodeURIComponent(receipt.payableId)}#payable-${encodeURIComponent(receipt.payableId)}`}
                  >
                    {t("receiptViewPayable")}
                  </Link>
                )}
              </MovementCard>
            ))}
          </div>
          {totalPages > 1 && (
            <nav
              aria-label={t("receiptPagination")}
              className="mt-5 flex items-center justify-between gap-3"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  rel="prev"
                  className="inline-flex min-h-11 items-center rounded-md border border-surface-border px-4 text-sm font-medium text-zinc-700 hover:bg-surface-hover dark:text-zinc-200"
                >
                  {tc("previousPage")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("receiptPageOf", { page: String(page), pages: String(totalPages) })}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  rel="next"
                  className="inline-flex min-h-11 items-center rounded-md border border-surface-border px-4 text-sm font-medium text-zinc-700 hover:bg-surface-hover dark:text-zinc-200"
                >
                  {tc("nextPage")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}

      <Modal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        title={t("receiveSupplies")}
        size="xl"
        variant="workspace"
      >
        <InventoryReceiptForm
          key={receiptFormKey}
          items={items}
          accounts={accounts}
          onDone={() => setShowReceipt(false)}
        />
      </Modal>
    </div>
  );
}
