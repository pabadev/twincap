"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { SerializedAccount } from "../../../../core/domain/account";
import {
  INVENTORY_UNITS,
  getBaseUnit,
  getUnitFactorToBase,
} from "../../../../core/domain/inventory-units";
import type { InventoryUnit } from "../../../../core/domain/inventory-units";
import { CURRENCY_EXPONENTS } from "../../../../core/domain/currency";
import type { Currency } from "../../../../core/domain/currency";
import { useLocale, useT } from "../../../../i18n/client";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { Alert } from "../../../../components/ui/alert";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";
import { receiveInventoryReceiptAction } from "./actions";
import { toDateInputValue } from "../../../../lib/date";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import { decimalAmountToMinorUnits } from "../../../../core/domain/money";
import Link from "next/link";
import { formatAmount } from "../../../../lib/format";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import {
  RECEIPT_LINE_DESKTOP_HEADER_CLASSES,
  RECEIPT_LINE_GRID_CLASSES,
  RECEIPT_LINE_ITEM_CELL_CLASSES,
  RECEIPT_LINE_MOBILE_HEADER_CLASSES,
} from "./inventory-receipt-layout";
import { Trash2 } from "lucide-react";

type Line = { itemId: string; quantity: string; unit: InventoryUnit | ""; amount: string };

export function InventoryReceiptForm({
  items,
  accounts,
  onDone,
}: {
  items: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  onDone: () => void;
}) {
  const t = useT("Catalog");
  const tc = useT("Common");
  const tt = useT("Toast");
  const translateError = useActionError();
  const { addToast } = useToast();
  const [state, action, pending] = useActionState(receiveInventoryReceiptAction, null);
  const products = items.filter(
    (item) => item.type === "product" && item.comboVersions.length === 0,
  );
  const [accountId, setAccountId] = useState("");
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currency = selectedAccount?.currency as Currency | undefined;
  const [initialPayment, setInitialPayment] = useState("0");
  const [lines, setLines] = useState<Line[]>([
    {
      itemId: "",
      quantity: "",
      unit: "",
      amount: "",
    },
  ]);
  const parseMinorUnits = (raw: string): bigint | null => {
    if (!currency || !raw.trim()) return null;
    try {
      return BigInt(decimalAmountToMinorUnits(raw, currency, true));
    } catch {
      return null;
    }
  };
  const lineAmounts = lines.map((line) => parseMinorUnits(line.amount));
  const paymentMinorUnits = parseMinorUnits(initialPayment);
  // BigInt via functional calls (BigInt(x) is legal under target ES2017;
  // 0n literals are NOT compiled below ES2020).
  const zero = BigInt(0);
  const totalMinorUnits = lineAmounts.reduce<bigint>((sum, amount) => sum + (amount ?? zero), zero);
  const totalIsComplete = lineAmounts.every((amount) => amount !== null);
  const totalIsValid =
    totalIsComplete && totalMinorUnits > zero && totalMinorUnits <= BigInt(Number.MAX_SAFE_INTEGER);
  const paymentExceedsTotal =
    totalIsValid && paymentMinorUnits !== null && paymentMinorUnits > totalMinorUnits;
  const hasOutstandingBalance = Boolean(
    currency &&
    totalIsComplete &&
    totalMinorUnits > zero &&
    paymentMinorUnits !== null &&
    paymentMinorUnits < totalMinorUnits,
  );
  const [date] = useState(() => toDateInputValue());
  const locale = useLocale();

  // U1 regression fix (same bug class as the 26+ sibling forms): one-shot
  // `successShownRef` guard. `useActionState` keeps `state.success` truthy
  // forever and `tt`/`onDone` identities change after a refresh or parent
  // re-render; without the guard the effect re-fires and stacks toasts.
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tt(state.success), "success");
      onDone();
    }
  }, [state?.success, addToast, tt, onDone]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function serializeLines() {
    return JSON.stringify(
      lines.map((line) => {
        const product = products.find((item) => item.id === line.itemId);
        const unit = line.unit || product?.saleUnit || "unit";
        return {
          itemId: line.itemId,
          quantity: Number(line.quantity),
          unit,
          amount: line.amount,
        };
      }),
    );
  }

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col lg:h-full">
      <IdempotencyField />
      {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <input type="hidden" name="lines" value={serializeLines()} />
      <div className="grid shrink-0 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        <Select
          id="receiptAccount"
          name="accountId"
          label={t("receiptAccount")}
          labelClassName="text-xs sm:text-sm"
          required
          placeholder={t("receiptChooseAccount")}
          value={accountId}
          onChange={(event) => {
            const nextAccountId = event.target.value;
            const nextAccount = accounts.find((account) => account.id === nextAccountId);
            if (nextAccount?.currency !== currency) {
              if (
                currency &&
                nextAccount &&
                (initialPayment !== "0" || lines.some((line) => line.amount.trim() !== ""))
              ) {
                addToast(t("receiptCurrencyAmountsReset"), "info");
              }
              setInitialPayment("0");
              setLines((current) => current.map((line) => ({ ...line, amount: "" })));
            }
            setAccountId(nextAccountId);
          }}
          options={accounts.map((account) => ({
            value: account.id,
            label: `${account.name} (${account.currency})`,
          }))}
        />
        <Input
          id="receiptSupplier"
          name="supplierName"
          label={t(hasOutstandingBalance ? "receiptSupplier" : "receiptSupplierOptional")}
          labelClassName="text-xs sm:text-sm"
          required={hasOutstandingBalance}
          maxLength={120}
        />
        <Input
          id="receiptReference"
          name="reference"
          label={t("receiptReference")}
          labelClassName="text-xs sm:text-sm"
          maxLength={120}
        />
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:overflow-hidden">
        <section
          className="flex min-h-0 flex-col lg:overflow-hidden"
          aria-labelledby="receipt-lines-title"
        >
          <div className="mb-2 shrink-0">
            <h3
              id="receipt-lines-title"
              className="text-sm font-semibold text-zinc-900 dark:text-white"
            >
              {t("receiptLinesTitle")}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 sm:text-xs">
              {t("receiptLinesHint")}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto lg:pr-1">
              <div className={RECEIPT_LINE_DESKTOP_HEADER_CLASSES} aria-hidden="true">
                <span>{t("receiptItem")}</span>
                <span>{t("quantityShort")}</span>
                <span>{t("saleUnit")}</span>
                <span>{t("receiptLineAmountShort", { currency: currency ?? "—" })}</span>
                <span />
              </div>
              <div className={RECEIPT_LINE_MOBILE_HEADER_CLASSES} aria-hidden="true">
                <span>{t("quantityShort")}</span>
                <span>{t("saleUnit")}</span>
                <span>{t("receiptLineAmountShort", { currency: currency ?? "—" })}</span>
                <span />
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => {
                  const product = products.find((item) => item.id === line.itemId);
                  const compatibleUnits = INVENTORY_UNITS.filter(
                    (unit) => product && getBaseUnit(unit) === getBaseUnit(product.saleUnit),
                  );
                  return (
                    <div key={`${line.itemId}-${index}`} className={RECEIPT_LINE_GRID_CLASSES}>
                      <div className={RECEIPT_LINE_ITEM_CELL_CLASSES}>
                        <Select
                          id={`receiptItem-${index}`}
                          aria-label={`${t("receiptItem")} ${index + 1}`}
                          required
                          value={line.itemId}
                          placeholder={t("receiptItem")}
                          onChange={(event) => {
                            const selected = products.find(
                              (item) => item.id === event.target.value,
                            );
                            updateLine(index, {
                              itemId: event.target.value,
                              unit: selected?.saleUnit ?? "",
                            });
                          }}
                          options={products.map((item) => ({ value: item.id, label: item.name }))}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>
                      <Input
                        id={`receiptQuantity-${index}`}
                        aria-label={`${t("quantityShort")} ${product?.name ?? index + 1}`}
                        type="number"
                        min={
                          line.unit
                            ? line.unit === "unit" || getUnitFactorToBase(line.unit) < 1000
                              ? String(1 / getUnitFactorToBase(line.unit))
                              : "0.001"
                            : undefined
                        }
                        step={
                          !line.unit
                            ? undefined
                            : line.unit === "unit" || getUnitFactorToBase(line.unit) < 1000
                              ? String(1 / getUnitFactorToBase(line.unit))
                              : "0.001"
                        }
                        required
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        className="h-9 px-2 text-xs sm:text-sm"
                      />
                      <Select
                        id={`receiptUnit-${index}`}
                        aria-label={`${t("saleUnit")} ${product?.name ?? index + 1}`}
                        value={line.unit}
                        placeholder={t("selectUnit")}
                        onChange={(event) =>
                          updateLine(index, { unit: event.target.value as InventoryUnit })
                        }
                        options={compatibleUnits.map((unit) => ({
                          value: unit,
                          label: t(`unit_${unit}`),
                        }))}
                        className="h-9 px-2 text-xs sm:text-sm"
                      />
                      <Input
                        id={`receiptAmount-${index}`}
                        aria-label={`${t("receiptLineAmount", { currency: currency ?? "—" })} ${product?.name ?? index + 1}`}
                        type="number"
                        min="0"
                        step={currency ? (CURRENCY_EXPONENTS[currency] ? "0.01" : "1") : "any"}
                        required
                        disabled={!currency}
                        value={line.amount}
                        onChange={(event) => updateLine(index, { amount: event.target.value })}
                        className="h-9 px-2 text-xs sm:text-sm"
                      />
                      {lines.length > 1 && (
                        <ActionIconButton
                          icon={Trash2}
                          label={`${t("receiptRemoveLine")} ${product?.name ?? index + 1}`}
                          tone="danger"
                          onClick={() =>
                            setLines((current) => current.filter((_, i) => i !== index))
                          }
                          className="h-9 w-9"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={products.length === 0}
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    itemId: "",
                    quantity: "",
                    unit: "",
                    amount: "",
                  },
                ])
              }
            >
              {t("receiptAddLine")}
            </Button>
          </div>
        </section>
        <aside className="mt-3 min-h-0 space-y-2 sm:mt-4 sm:space-y-3 lg:mt-0 lg:overflow-y-auto lg:pl-1">
          <Input
            id="receiptInitialPayment"
            name="initialPayment"
            hint={tc("moneyNoSeparators")}
            type="number"
            label={
              currency
                ? t("receiptInitialPaymentWithCurrency", { currency })
                : t("receiptInitialPayment")
            }
            labelClassName="text-xs sm:text-sm"
            min="0"
            step={currency ? (CURRENCY_EXPONENTS[currency] ? "0.01" : "1") : "any"}
            value={initialPayment}
            onChange={(event) => setInitialPayment(event.target.value)}
            disabled={!currency}
            required
          />
          <div className="rounded-lg border border-surface-border p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("receiptTotal")}</span>
              <strong className="text-zinc-900 dark:text-white">
                {totalIsValid && currency
                  ? formatAmount(Number(totalMinorUnits), currency, locale)
                  : "—"}
              </strong>
            </div>
            {!currency && accounts.length > 0 && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {t("receiptSelectAccountFirst")}
              </p>
            )}
            {currency && !totalIsValid && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {t("receiptCompleteLines")}
              </p>
            )}
            {paymentExceedsTotal && (
              <p className="mt-2 text-xs text-danger">{t("receiptPaymentExceedsTotal")}</p>
            )}
            {currency && paymentMinorUnits === null && initialPayment.trim() !== "" && (
              <p className="mt-2 text-xs text-danger">{t("receiptInvalidPayment")}</p>
            )}
          </div>
          {accounts.length === 0 && (
            <Alert variant="info">
              {t("receiptNoAccount")}{" "}
              <Link href="/accounts" className="font-medium text-primary hover:underline">
                {t("receiptGoToAccounts")}
              </Link>
            </Alert>
          )}
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 sm:text-xs">
            {t("receiptFinancialHint")}
          </p>
        </aside>
      </div>
      <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-3 border-t border-surface-border pt-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            pending ||
            !accountId ||
            products.length === 0 ||
            !totalIsValid ||
            paymentMinorUnits === null ||
            paymentExceedsTotal
          }
          loading={pending}
        >
          {pending ? t("savingAdjustment") : t("receiptSave")}
        </Button>
      </div>
    </form>
  );
}
