"use client";

import { useState, useRef, useCallback } from "react";
import { useT, useLocale } from "../../../../i18n/client";
import type { SerializedSale } from "../../../../core/domain/sale";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { SerializedAccount } from "../../../../core/domain/account";
import type { SerializedClient } from "../../../../core/domain/client";
import { SaleForm } from "./sale-form";
import { AbonoForm } from "./abono-form";
import { SaleDetailModal } from "./sale-detail-modal";
import { DeleteSaleButton } from "./delete-sale-button";
import { formatAmount, formatDate } from "../../../../lib/format";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Icon } from "../../../../components/ui/icon";
import { Modal } from "../../../../components/ui/modal";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Button } from "../../../../components/ui/button";
import { Select } from "../../../../components/ui/select";
import { SearchInput } from "../../../../components/ui/search-input";
import {
  Eye,
  Pencil,
  ShoppingCart,
  Download,
  Loader2,
  SlidersHorizontal,
  Receipt,
} from "lucide-react";
import { downloadCsv } from "../../../../lib/download-csv";
import { useToast } from "../../../../lib/hooks/use-toast";
import { exportSalesCsvAction, exportSalesPdfAction } from "./actions";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MovementCard } from "../../../../components/ui/movement-card";
import { creditLaunchHref } from "./sale-credit-links";
import { SaleReceiptModal } from "./sale-receipt-modal";
import { filterSalesForCsv, summarizeSalesByCurrency } from "./export-csv";

interface SaleListProps {
  sales: SerializedSale[];
  catalogItems: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  clients: SerializedClient[];
  /** H14: pending per sale owned by its linked CreditGranted, when one exists. */
  creditPendingBySaleId?: Record<string, number>;
  /** R5-D0b: initial payment per sale = the linked credit's first abono. */
  creditInitialPaymentBySaleId?: Record<string, number>;
  creditIdBySaleId?: Record<string, string>;
  /**
   * Render the filter bar expanded. Default false (toggle-collapsed as in the
   * deployed UI); the UX-12 a11y measured-inventory test uses true so the
   * associated labels exist in static markup.
   */
  defaultFiltersOpen?: boolean;
}

export function SaleList({
  sales,
  catalogItems,
  accounts,
  clients,
  creditPendingBySaleId,
  creditInitialPaymentBySaleId,
  creditIdBySaleId,
  defaultFiltersOpen = false,
}: SaleListProps) {
  const [showForm, setShowForm] = useState(false);
  // C12-1: close-guard for the sale form modal — unsaved changes trigger a
  // confirmation instead of silent discard.
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const saleDirtyRef = useRef(false);
  const closeSaleForm = useCallback(() => setShowForm(false), []);
  const handleSaleRequestClose = useCallback(() => {
    if (showCloseConfirm) return;
    if (saleDirtyRef.current) {
      setShowCloseConfirm(true);
    } else {
      closeSaleForm();
    }
  }, [showCloseConfirm, closeSaleForm]);
  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    closeSaleForm();
  }, [closeSaleForm]);
  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  // DOM-1 (EXC-2): the pencil opens the detail modal straight into the price
  // editor (founder: the edit was invisible — it lived only inside the eye).
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [abonoSaleId, setAbonoSaleId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "credit">("all");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const t = useT("Sales");
  const tCommon = useT("Common");
  const tExport = useT("Export");
  const locale = useLocale();
  const { addToast } = useToast();

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (search ? 1 : 0);

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const catalogMap = new Map(catalogItems.map((ci) => [ci.id, ci.name]));

  const effectiveSales = sales.map((sale) => {
    const linkedPending = creditPendingBySaleId?.[sale.id];
    return linkedPending === undefined ? sale : { ...sale, pending: linkedPending };
  });
  const filtered = filterSalesForCsv(
    effectiveSales,
    { dateFrom, dateTo, status: statusFilter, search },
    Object.fromEntries(clientMap),
  );
  const salesTotals = summarizeSalesByCurrency(filtered);

  // R13-H3: export the FULL filtered set (server-side query) using the current
  // client-side filter state, then trigger a browser download.
  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await exportSalesCsvAction({
        dateFrom,
        dateTo,
        status: statusFilter,
        search,
      });
      if (res.ok) {
        downloadCsv(res.csv, res.filename);
        addToast(tExport("done"), "success");
      } else {
        addToast(tExport("failed"), "error");
      }
    } catch {
      addToast(tExport("failed"), "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await exportSalesPdfAction({ dateFrom, dateTo, status: statusFilter, search });
      if (!res.ok) {
        addToast(tExport("failed"), "error");
        return;
      }
      const bytes = Uint8Array.from(atob(res.base64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      addToast(tExport("done"), "success");
    } catch {
      addToast(tExport("failed"), "error");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            {t("newSale")}
          </Button>
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={closeSaleForm}
        onRequestClose={handleSaleRequestClose}
        title={t("createSale")}
        size="xl"
        variant="workspace"
      >
        <SaleForm
          catalogItems={catalogItems}
          accounts={accounts}
          clients={clients}
          onDone={closeSaleForm}
          onReceipt={(saleId) => {
            closeSaleForm();
            setReceiptSaleId(saleId);
          }}
          onCancel={handleSaleRequestClose}
          dirtyRef={saleDirtyRef}
        />
      </Modal>

      {/* C12-1: close confirmation — sibling of the sale Modal to avoid
          overlapping focus traps. */}
      <ConfirmDialog
        open={showCloseConfirm}
        onClose={handleCancelClose}
        onConfirm={handleConfirmClose}
        title={t("closeSaleTitle")}
        description={t("closeSaleDescription")}
        confirmLabel={t("leaveWithoutSaving")}
        cancelLabel={t("continueEditing")}
        tone="danger"
      />

      <Modal open={!!abonoSaleId} onClose={() => setAbonoSaleId(null)} title={t("addPayment")}>
        {abonoSaleId && (
          <AbonoForm
            saleId={abonoSaleId}
            accounts={accounts}
            pending={
              creditPendingBySaleId?.[abonoSaleId] ??
              sales.find((s) => s.id === abonoSaleId)?.pending
            }
            onDone={() => setAbonoSaleId(null)}
          />
        )}
      </Modal>

      <SaleDetailModal
        key={`${detailSaleId ?? "none"}-${detailEditMode ? "edit" : "view"}`}
        saleId={detailSaleId}
        initialEditMode={detailEditMode}
        onClose={() => {
          setDetailSaleId(null);
          setDetailEditMode(false);
        }}
      />
      <SaleReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />

      {sales.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ShoppingCart} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="min-w-[min(100%,16rem)] flex-1">
              <SearchInput
                ariaLabel={t("filterSearch")}
                placeholder={t("filterSearch")}
                clearLabel={tCommon("clearSearch")}
                value={search}
                onValueChange={setSearch}
                inputProps={{ id: "sale-filter-search" }}
                hideIcon
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <>
                  <Icon icon={Download} size="sm" />
                  {tExport("pdfButton")}
                </>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={isExporting}>
              {isExporting ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <>
                  <Icon icon={Download} size="sm" />
                  {tExport("button")}
                </>
              )}
            </Button>
          </div>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="sales-filters"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-surface-card dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-surface-hover"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("filters")}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: collapsible filter bar */}
          {filtersOpen && (
            <div id="sales-filters" className="mb-6 sm:hidden">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label
                    htmlFor="sale-filter-dateFrom-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterDateFrom")}
                  </label>
                  <input
                    id="sale-filter-dateFrom-mobile"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sale-filter-dateTo-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterDateTo")}
                  </label>
                  <input
                    id="sale-filter-dateTo-mobile"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sale-filter-status-mobile"
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {t("filterStatus")}
                  </label>
                  <Select
                    id="sale-filter-status-mobile"
                    options={[
                      { value: "all", label: t("filterAllStatus") },
                      { value: "paid", label: t("filterPaid") },
                      { value: "credit", label: t("filterCredit") },
                    ]}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "paid" | "credit")}
                    className="w-40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date and status filters are disclosed on every breakpoint. */}
          {filtersOpen && (
            <div className="mb-4 hidden flex-wrap items-center gap-3 sm:flex">
              <div>
                <label
                  htmlFor="sale-filter-dateFrom"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {t("filterDateFrom")}
                </label>
                <input
                  id="sale-filter-dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="sale-filter-dateTo"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {t("filterDateTo")}
                </label>
                <input
                  id="sale-filter-dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="sale-filter-status"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {t("filterStatus")}
                </label>
                <Select
                  id="sale-filter-status"
                  options={[
                    { value: "all", label: t("filterAllStatus") },
                    { value: "paid", label: t("filterPaid") },
                    { value: "credit", label: t("filterCredit") },
                  ]}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "paid" | "credit")}
                  className="w-40"
                />
              </div>
            </div>
          )}

          {filtered.length === 0 && sales.length > 0 && <EmptyState title={t("noResults")} />}

          {filtered.length > 0 && (
            <section
              aria-label={t("salesTotals")}
              className="mb-4 rounded-lg border border-surface-border bg-surface-card p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t("salesTotals")}
                </h2>
                <span className="text-xs text-zinc-500">
                  {t("salesCount", { count: String(filtered.length) })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {salesTotals.map((totals) => (
                  <div key={totals.currency} className="rounded-md bg-surface-input p-3">
                    <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {totals.currency}
                    </p>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt>{t("salesTotal")}</dt>
                        <dd className="font-medium">
                          {formatAmount(totals.sales, totals.currency, locale)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t("collectedTotal")}</dt>
                        <dd>{formatAmount(totals.collected, totals.currency, locale)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t("pendingTotal")}</dt>
                        <dd>{formatAmount(totals.pending, totals.currency, locale)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-3">
            {filtered.map((sale) => {
              // R15.3.2 P2-2: currency resolution is NEVER silent. Canonical
              // chain: 1) the first line item's unitPrice.currency (mirrors the
              // receiving account's currency at sale time); 2) the sale's
              // account lookup (defensive against legacy/malformed docs that
              // carry no line items); 3) LAUNCH — a missing currency is a
              // data-integrity breach, and rendering COP instead would silently
              // misreport every amount on the row.
              const currency = (() => {
                const itemCurrency = sale.items[0]?.unitPrice.currency;
                if (itemCurrency) return itemCurrency;
                const accountCurrency = accounts.find((a) => a.id === sale.accountId)?.currency;
                if (accountCurrency) return accountCurrency;
                throw new Error(
                  `Sale ${sale.id} currency unresolvable: no line-item currency and account ${sale.accountId ?? "unknown"} not found`,
                );
              })();
              // H14: a linked credit owns the real pending of the sale.
              const hasLinkedCredit = Object.prototype.hasOwnProperty.call(
                creditPendingBySaleId ?? {},
                sale.id,
              );
              const effectivePending = hasLinkedCredit
                ? (creditPendingBySaleId as Record<string, number>)[sale.id]
                : sale.pending;
              // R5-D0b: the sale's initial payment is the credit's first abono.
              const initialPayment = hasLinkedCredit
                ? ((creditInitialPaymentBySaleId as Record<string, number>)[sale.id] ?? 0)
                : 0;

              return (
                <MovementCard
                  key={sale.id}
                  id={sale.id}
                  fields={[
                    { key: "date", label: t("date"), value: formatDate(sale.date, locale) },
                    {
                      key: "items",
                      label: t("lineItems"),
                      value:
                        sale.items.length > 0
                          ? (catalogMap.get(sale.items[0].itemId) ?? t("itemCount")) +
                            (sale.items.length > 1
                              ? " +" +
                                (sale.items.length - 1) +
                                " " +
                                (sale.items.length - 1 !== 1
                                  ? t("itemCount_plural")
                                  : t("itemCount"))
                              : "")
                          : t("itemCount"),
                      primary: true,
                    },
                    {
                      key: "total",
                      label: t("total"),
                      value: formatAmount(sale.total, currency, locale),
                      primary: true,
                    },
                    {
                      key: "client",
                      label: t("client"),
                      value: sale.clientId
                        ? (clientMap.get(sale.clientId) ?? t("generalClient"))
                        : t("generalClient"),
                    },
                    {
                      key: "status",
                      label: t("status"),
                      value: sale.paymentMode === "paid-in-full" ? t("paidInFull") : t("onCredit"),
                    },
                    ...(sale.paymentMode === "on-credit" && initialPayment > 0
                      ? [
                          {
                            key: "initial",
                            label: t("initialPaymentLabel"),
                            value: formatAmount(initialPayment, currency, locale),
                          },
                        ]
                      : []),
                    ...(sale.paymentMode === "on-credit"
                      ? [
                          {
                            key: "pending",
                            label: t("pending"),
                            value: formatAmount(effectivePending, currency, locale),
                          },
                        ]
                      : []),
                  ]}
                  actions={
                    <>
                      {creditIdBySaleId?.[sale.id] && (
                        <Link
                          href={creditLaunchHref(creditIdBySaleId[sale.id])}
                          aria-label={t("launchCredit")}
                          title={t("launchCredit")}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Icon icon={ExternalLink} size="sm" />
                        </Link>
                      )}
                      <ActionIconButton
                        icon={Eye}
                        label={t("details")}
                        tone="primary"
                        onClick={() => {
                          setDetailSaleId(sale.id);
                          setDetailEditMode(false);
                        }}
                      />
                      <ActionIconButton
                        icon={Receipt}
                        label={t("receiptView")}
                        tone="primary"
                        onClick={() => setReceiptSaleId(sale.id)}
                      />
                      <ActionIconButton
                        icon={Pencil}
                        label={t("editPrices")}
                        tone="primary"
                        onClick={() => {
                          setDetailSaleId(sale.id);
                          setDetailEditMode(true);
                        }}
                      />
                      {sale.paymentMode === "on-credit" &&
                        !hasLinkedCredit &&
                        effectivePending > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAbonoSaleId(sale.id)}
                            className="text-success hover:text-success/80"
                          >
                            {t("addAbono")}
                          </Button>
                        )}
                      <DeleteSaleButton saleId={sale.id} />
                    </>
                  }
                >
                  {hasLinkedCredit && sale.paymentMode === "on-credit" && effectivePending > 0 && (
                    <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      {t("managedInCredits")}
                    </p>
                  )}
                </MovementCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
