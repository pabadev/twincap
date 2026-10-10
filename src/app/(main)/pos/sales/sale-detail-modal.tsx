"use client";

import { useEffect, useState } from "react";
import { useT, useLocale } from "../../../../i18n/client";
import { getSaleDetailAction } from "./actions";
import type { SaleDetailSnapshot } from "../../../../core/application/sales";
import { DeleteSaleAbonoButton } from "./delete-sale-abono-button";
import { formatAmount, formatDate } from "../../../../lib/format";
import { Modal } from "../../../../components/ui/modal";
import { Alert } from "../../../../components/ui/alert";
import { Table } from "../../../../components/ui/table";
import { quantityFromBaseUnits } from "../../../../core/domain/inventory-units";

interface SaleDetailModalProps {
  saleId: string | null;
  onClose: () => void;
}

interface DetailState {
  id: string;
  snapshot?: SaleDetailSnapshot;
  errorKey?: string;
}

export function SaleDetailModal({ saleId, onClose }: SaleDetailModalProps) {
  const t = useT("Sales");
  const tCatalog = useT("Catalog");
  const tCommon = useT("Common");
  const tError = useT("error");
  const locale = useLocale();
  const [detail, setDetail] = useState<DetailState | null>(null);

  // Loading is derived, not stored: while the fetched record does not match
  // the requested one we are mid-flight. setState only ever runs in async
  // continuations, never synchronously inside an effect.
  const loading = !!saleId && detail?.id !== saleId;
  const snapshot = detail?.id === saleId ? (detail.snapshot ?? null) : null;
  const errorKey = detail?.id === saleId ? (detail.errorKey ?? null) : null;

  useEffect(() => {
    if (!saleId) return;
    let cancelled = false;
    getSaleDetailAction(saleId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setDetail({ id: saleId, snapshot: result.sale });
        } else {
          setDetail({ id: saleId, errorKey: result.error });
        }
      })
      .catch(() => {
        if (!cancelled) setDetail({ id: saleId, errorKey: "error.operationFailed" });
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const handleClose = () => {
    setDetail(null);
    onClose();
  };

  return (
    <Modal open={!!saleId} onClose={handleClose} title={t("saleDetail")} size="lg">
      {loading && (
        <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {tCommon("loading")}
        </p>
      )}

      {!loading && errorKey && (
        <Alert variant="danger">{tError(errorKey.replace("error.", ""))}</Alert>
      )}

      {!loading && snapshot && (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {tCommon("date")}
              </dt>
              <dd className="text-zinc-900 dark:text-white">{formatDate(snapshot.date, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {t("client")}
              </dt>
              <dd className="text-zinc-900 dark:text-white">
                {snapshot.clientName ?? t("generalClient")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {t("paymentMode")}
              </dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {snapshot.paymentMode === "paid-in-full" ? t("paidInFull") : t("onCredit")}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {t("status")}
              </dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    snapshot.status === "paid"
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {snapshot.status === "paid" ? t("statusPaid") : t("statusPending")}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {tCommon("account")}
              </dt>
              <dd className="text-zinc-900 dark:text-white">{snapshot.accountName ?? "—"}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("lineItems")}
            </h3>
            {/* Desktop (>=640px): compact modal table keeps its bespoke cells
                (pb-1 / py-1.5, text-xs header rows) — only the `<table>`
                element fits the ui/table contract here. */}
            <div className="max-md:hidden overflow-x-auto">
              <Table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <th className="pb-1 text-left">{t("item")}</th>
                    <th className="pb-1 text-right">{t("qty")}</th>
                    <th className="pb-1 text-right">{t("unitPrice")}</th>
                    <th className="pb-1 text-right">{t("subtotal")}</th>
                    <th className="pb-1 text-right">{t("inventoryCost")}</th>
                    <th className="pb-1 text-right">{t("grossProfit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {snapshot.items.map((item, idx) => (
                    <tr key={idx} className="text-zinc-600 dark:text-zinc-400">
                      <td className="py-1.5">
                        {item.itemName ?? t("itemDeleted")}
                        {item.formulaSnapshot && (
                          <div className="mt-1 text-xs text-zinc-500">
                            {t("formulaUsed", { version: String(item.formulaSnapshot.version) })}:{" "}
                            {item.formulaSnapshot.components
                              .map(
                                (component) =>
                                  `${component.name} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantityFromBaseUnits(component.stockQuantity, component.unit))} ${tCatalog(`unit_${component.unit}`)}`,
                              )
                              .join(", ")}
                          </div>
                        )}
                        {item.comboSnapshot && (
                          <div className="mt-1 text-xs text-zinc-500">
                            {t("comboUsed", { version: String(item.comboSnapshot.version) })}:{" "}
                            {item.comboSnapshot.components
                              .map(
                                (component) =>
                                  `${component.name} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantityFromBaseUnits(component.stockQuantity, component.unit))} ${tCatalog(`unit_${component.unit}`)}`,
                              )
                              .join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
                          item.quantity,
                        )}{" "}
                        {tCatalog(`unit_${item.unit}`)}
                      </td>
                      <td className="py-1.5 text-right">
                        {formatAmount(item.unitPrice.amount, item.unitPrice.currency, locale)}
                      </td>
                      <td className="py-1.5 text-right">
                        {formatAmount(item.subtotal, snapshot.currency, locale)}
                      </td>
                      <td className="py-1.5 text-right">
                        {item.isService
                          ? t("serviceNoInventoryCost")
                          : item.inventoryCostMinor === null
                            ? t(item.costTracked ? "costUnavailable" : "costNotTracked")
                            : formatAmount(item.inventoryCostMinor, snapshot.currency, locale)}
                      </td>
                      <td className="py-1.5 text-right">
                        {item.inventoryCostMinor === null
                          ? "—"
                          : formatAmount(
                              item.subtotal - item.inventoryCostMinor,
                              snapshot.currency,
                              locale,
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile (<640px): line items as stacked rows — 4 columns in a
                size-lg modal is cramped at card width (§20). Row 1: item name;
                row 2: qty × unit price; row 3: subtotal. */}
            <div className="space-y-2 md:hidden">
              {snapshot.items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {item.itemName ?? t("itemDeleted")}
                  </div>
                  {item.formulaSnapshot && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {t("formulaUsed", { version: String(item.formulaSnapshot.version) })}:{" "}
                      {item.formulaSnapshot.components
                        .map(
                          (component) =>
                            `${component.name} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantityFromBaseUnits(component.stockQuantity, component.unit))} ${tCatalog(`unit_${component.unit}`)}`,
                        )
                        .join(", ")}
                    </div>
                  )}
                  {item.comboSnapshot && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {t("comboUsed", { version: String(item.comboSnapshot.version) })}:{" "}
                      {item.comboSnapshot.components
                        .map(
                          (component) =>
                            `${component.name} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantityFromBaseUnits(component.stockQuantity, component.unit))} ${tCatalog(`unit_${component.unit}`)}`,
                        )
                        .join(", ")}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {t("qty")}:{" "}
                    {new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
                      item.quantity,
                    )}{" "}
                    {tCatalog(`unit_${item.unit}`)} ×{" "}
                    {formatAmount(item.unitPrice.amount, item.unitPrice.currency, locale)}
                  </div>
                  <div className="mt-1 text-right font-medium tabular-nums text-zinc-900 dark:text-white">
                    {formatAmount(item.subtotal, snapshot.currency, locale)}
                  </div>
                  <div className="mt-1 flex justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{t("inventoryCost")}</span>
                    <span>
                      {item.isService
                        ? t("serviceNoInventoryCost")
                        : item.inventoryCostMinor === null
                          ? t(item.costTracked ? "costUnavailable" : "costNotTracked")
                          : formatAmount(item.inventoryCostMinor, snapshot.currency, locale)}
                    </span>
                  </div>
                  {item.inventoryCostMinor !== null && (
                    <div className="flex justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>{t("grossProfit")}</span>
                      <span>
                        {formatAmount(
                          item.subtotal - item.inventoryCostMinor,
                          snapshot.currency,
                          locale,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <dl className="space-y-1 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700">
            <div className="flex justify-between">
              <dt className="text-zinc-600 dark:text-zinc-400">{t("total")}</dt>
              <dd className="font-medium text-zinc-900 dark:text-white">
                {formatAmount(snapshot.total, snapshot.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600 dark:text-zinc-400">{t("inventoryCost")}</dt>
              <dd className="font-medium text-zinc-900 dark:text-white">
                {snapshot.costComplete && snapshot.inventoryCostMinor !== null
                  ? formatAmount(snapshot.inventoryCostMinor, snapshot.currency, locale)
                  : t("costUnavailable")}
              </dd>
            </div>
            {snapshot.costComplete && snapshot.grossProfitMinor !== null ? (
              <div className="flex justify-between">
                <dt className="text-zinc-600 dark:text-zinc-400">{t("grossProfit")}</dt>
                <dd className="font-medium text-zinc-900 dark:text-white">
                  {formatAmount(snapshot.grossProfitMinor, snapshot.currency, locale)}
                </dd>
              </div>
            ) : (
              <div className="rounded-md bg-warning/10 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                {t("costIncompleteHint")}
              </div>
            )}
            {snapshot.paymentMode === "on-credit" && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-600 dark:text-zinc-400">{t("initialPayment")}</dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {formatAmount(snapshot.initialPayment, snapshot.currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-600 dark:text-zinc-400">{t("pending")}</dt>
                  <dd
                    className={`font-medium ${snapshot.pending > 0 ? "text-debt" : "text-success"}`}
                  >
                    {formatAmount(snapshot.pending, snapshot.currency, locale)}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {(snapshot.abonos.length > 0 || snapshot.hasLinkedCredit) && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("abonos")}
              </h3>
              {snapshot.hasLinkedCredit && (
                <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {t("managedInCredits")}
                </p>
              )}
              {snapshot.abonos.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Compact modal table: keeps its bespoke cells (pb-1 /
                      py-1.5, text-xs header row) — only the `<table>` element
                      fits the ui/table contract here. */}
                  <Table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <th className="pb-1 text-left">{tCommon("date")}</th>
                        <th className="pb-1 text-right">{tCommon("amount")}</th>
                        {!snapshot.hasLinkedCredit && (
                          <th className="pb-1 text-right">{tCommon("actions")}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {snapshot.abonos.map((abono) => (
                        <tr key={abono.id} className="text-zinc-600 dark:text-zinc-400">
                          <td className="py-1.5">{formatDate(abono.date, locale)}</td>
                          <td className="py-1.5 text-right">
                            +{formatAmount(abono.amount.amount, abono.amount.currency, locale)}
                          </td>
                          {!snapshot.hasLinkedCredit && (
                            <td className="py-1.5 text-right">
                              <DeleteSaleAbonoButton
                                saleId={snapshot.id}
                                abonoId={abono.id}
                                onDeleted={handleClose}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("noAbonos")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
