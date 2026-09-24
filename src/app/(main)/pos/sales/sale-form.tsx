"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../../i18n/client";
import { useActionError } from "../../../../lib/use-action-error";
import { createSaleAction } from "./actions";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import { ClientForm } from "../../clients/client-form";
import { CatalogForm } from "../catalog/catalog-form";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { SerializedAccount } from "../../../../core/domain/account";
import type { SerializedClient } from "../../../../core/domain/client";
import type { PaymentMode } from "../../../../core/domain/sale";
import { PAYMENT_MODES } from "../../../../core/domain/sale";
import { DEFAULT_CURRENCY } from "../../../../core/domain/currency";
import type { Currency } from "../../../../core/domain/currency";
import { Input } from "../../../../components/ui/input";
import { FormField } from "../../../../components/ui/form-field";
import { Alert } from "../../../../components/ui/alert";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Modal } from "../../../../components/ui/modal";
import { Trash2 } from "lucide-react";
import { useToast } from "../../../../lib/hooks/use-toast";
import { formatAmount } from "../../../../lib/format";
import { toDateInputValue } from "../../../../lib/date";

interface LineItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

interface SaleFormProps {
  catalogItems: SerializedCatalogItem[];
  accounts: SerializedAccount[];
  clients: SerializedClient[];
  /** Called after a successful create (sale persisted). Also used as the legacy close path. */
  onDone?: () => void;
  /**
   * Called when the user explicitly cancels (Cancel button). The parent wires
   * this to the dirty-check close-guard so unsaved changes trigger a
   * confirmation instead of silent discard. Falls back to `onDone` when omitted.
   */
  onCancel?: () => void;
  /**
   * Optional ref the form writes its current dirty flag to, synchronously after
   * each state change. The parent reads it in the close-guard handler to decide
   * whether to show a confirmation. Avoids a callback round-trip and stale
   * closures in the parent's event handler.
   */
  dirtyRef?: MutableRefObject<boolean>;
}

export function SaleForm({
  catalogItems,
  accounts,
  clients,
  onDone,
  onCancel,
  dirtyRef,
}: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(createSaleAction, null);
  const t = useT("Sales");
  const tCommon = useT("Common");
  const tCatalog = useT("Catalog");
  const tToast = useT("Toast");
  const tError = useT("error");
  // I8: createSaleAction returns error.* i18n keys — resolve them here.
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // A1 (F2+F3): the client <Select> options must come from a LOCAL copy of
  // `clients`, not the prop directly. The prop is a one-shot snapshot from
  // the parent (either the /sales page or the FAB's cached posData in
  // global-movement-provider.tsx); after handleClientCreated the new client
  // never enters the prop, so the select would not list it. A local state
  // tracks locally added clients; the final options merge prop + local.
  const [localClients, setLocalClients] = useState<SerializedClient[]>([]);
  const clientOptions = useMemo(() => {
    // Merge prop clients with locally added ones, deduping by id.
    const map = new Map<string, SerializedClient>();
    for (const c of clients) map.set(c.id, c);
    for (const c of localClients) map.set(c.id, c);
    return Array.from(map.values());
  }, [clients, localClients]);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onDone?.();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("paid-in-full");
  const [clientId, setClientId] = useState<string>(""); // empty = general client
  const [initialPayment, setInitialPayment] = useState<string>("0");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      itemId: catalogItems[0]?.id ?? "",
      quantity: 1,
      unitPrice: catalogItems[0]?.unitPrice.amount ?? 0,
    },
  ]);

  // Dirty detection (C12-1): the form has unsaved changes when any field
  // deviates from its initial value. The preselected first line item (from the
  // catalog) does NOT count as dirty — it is the default, not a user edit.
  // The parent reads `dirtyRef` synchronously in the close-guard handler.
  const initialLineItems = useMemo<LineItem[]>(
    () => [
      {
        itemId: catalogItems[0]?.id ?? "",
        quantity: 1,
        unitPrice: catalogItems[0]?.unitPrice.amount ?? 0,
      },
    ],
    [catalogItems],
  );

  const isDirty = useMemo(() => {
    if (clientId !== "") return true;
    if (paymentMode !== "paid-in-full") return true;
    if (currency !== DEFAULT_CURRENCY) return true;
    if (initialPayment !== "0") return true;
    if (localClients.length > 0) return true;
    if (lineItems.length !== initialLineItems.length) return true;
    return lineItems.some(
      (li, i) =>
        li.itemId !== initialLineItems[i]?.itemId ||
        li.quantity !== initialLineItems[i]?.quantity ||
        li.unitPrice !== initialLineItems[i]?.unitPrice,
    );
  }, [lineItems, initialLineItems, clientId, paymentMode, currency, initialPayment, localClients]);

  // Sync dirty flag to the parent-owned ref so the close-guard handler can
  // read it without stale-closure issues.
  useEffect(() => {
    if (dirtyRef) dirtyRef.current = isDirty;
  }, [isDirty, dirtyRef]);

  // Quick-create from inside the sale form: auto-select the new entity so the
  // user can keep building the sale without leaving the form. A1 (F2+F3):
  // also append the new client to the local option list so it becomes
  // selectable immediately (the prop snapshot would not include it).
  function handleClientCreated(client?: SerializedClient) {
    setShowClientForm(false);
    if (client) {
      setLocalClients((prev) => {
        if (prev.some((c) => c.id === client.id)) return prev;
        return [...prev, client];
      });
      setClientId(client.id);
    }
  }

  function handleItemCreated(item?: SerializedCatalogItem) {
    setShowItemForm(false);
    if (item) {
      setLineItems((prev) =>
        prev.map((li, idx) =>
          idx === 0 ? { ...li, itemId: item.id, unitPrice: item.unitPrice.amount } : li,
        ),
      );
      setCurrency(item.unitPrice.currency);
    }
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { itemId: catalogItems[0]?.id ?? "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleItemSelect(index: number, itemId: string) {
    const item = catalogItems.find((c) => c.id === itemId);
    if (item) {
      setLineItems((prev) =>
        prev.map((li, idx) =>
          idx === index ? { ...li, itemId, unitPrice: item.unitPrice.amount } : li,
        ),
      );
      setCurrency(item.unitPrice.currency);
    }
  }

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  // H14: on-credit sales require a real client and a valid upfront payment.
  const isOnCredit = paymentMode === "on-credit";
  const parsedInitialPayment = Number(initialPayment) || 0;
  const needsClient = isOnCredit && !clientId;
  const initialPaymentInvalid =
    isOnCredit &&
    (!Number.isFinite(parsedInitialPayment) ||
      parsedInitialPayment < 0 ||
      parsedInitialPayment > total);
  const submitBlocked = isPending || needsClient || initialPaymentInvalid;

  return (
    <div>
      {/* Nested modals MUST live outside the sale <form> — a <form> cannot contain
          another <form>, and browsers would bind the inner controls to the outer
          form, so the create buttons would never submit (no-op). */}
      <form
        action={formAction}
        onSubmit={(e) => {
          if (isPending) {
            e.preventDefault();
            return;
          }
        }}
        className="space-y-4"
      >
        <IdempotencyField />
        <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
        {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}

        <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="clientId" value={clientId} />

        {/* C12-3: responsive two-zone layout. Mobile keeps the original single-column
            flow (settings → line items → summary). At lg+ the form becomes a grid:
            LEFT = cart/line items, RIGHT = settings (row 1) + sticky summary (row 2).
            DOM order matches mobile order; desktop placement is via grid positioning. */}
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 lg:space-y-0">
          {/* Settings: payment, account, client, initial payment, date.
              Mobile: first section. Desktop: right column, row 1. */}
          <div className="space-y-4 lg:col-start-2 lg:row-start-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Select
                id="paymentMode"
                name="paymentMode"
                label={t("paymentMode")}
                required
                disabled={isPending}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                options={PAYMENT_MODES.map((m) => ({
                  value: m,
                  label: m === "paid-in-full" ? t("paidInFull") : t("onCredit"),
                }))}
              />

              <Select
                id="accountId"
                name="accountId"
                label={t("account")}
                required
                disabled={isPending}
                placeholder={tCommon("select")}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowClientForm(true)}
                  disabled={isPending}
                  className="text-xs font-medium text-primary hover:text-primary-hover dark:text-primary"
                >
                  {t("createClient")}
                </button>
              </div>
              <FormField
                id="clientId"
                label={t("client")}
                hint={needsClient ? t("clientRequiredForCredit") : undefined}
              >
                <Select
                  required={isOnCredit}
                  disabled={isPending}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  options={[
                    { value: "", label: t("generalClient") },
                    ...clientOptions.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </FormField>
            </div>

            {isOnCredit && (
              <FormField
                id="initialPayment"
                label={`${t("initialPayment")} (${currency})`}
                error={
                  initialPaymentInvalid
                    ? parsedInitialPayment > total
                      ? t("initialPaymentExceedsTotal")
                      : tError("invalidData")
                    : undefined
                }
              >
                <Input
                  name="initialPayment"
                  type="number"
                  min="0"
                  required
                  disabled={isPending}
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                />
              </FormField>
            )}

            <Input
              id="date"
              name="date"
              type="date"
              label={t("date")}
              required
              disabled={isPending}
              defaultValue={toDateInputValue()}
              max={toDateInputValue()}
            />
          </div>

          {/* Cart / line items.
              Mobile: second section. Desktop: left column, row 1. */}
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("lineItems")}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowItemForm(true)}
                  disabled={isPending}
                  className="text-xs font-medium text-primary hover:text-primary-hover dark:text-primary"
                >
                  {t("createItem")}
                </button>
                <button
                  type="button"
                  onClick={addLineItem}
                  disabled={isPending}
                  className="text-xs text-primary hover:text-primary-hover dark:text-primary"
                >
                  {t("addItem")}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {lineItems.map((li, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <FormField id={`item-${idx}`} label={t("item")} showLabel={idx === 0}>
                      <Select
                        value={li.itemId}
                        onChange={(e) => handleItemSelect(idx, e.target.value)}
                        disabled={isPending}
                        placeholder={tCommon("select")}
                        options={catalogItems.map((item) => ({
                          value: item.id,
                          label: `${item.name} (${tCatalog(`type_${item.type}`)})`,
                        }))}
                      />
                    </FormField>
                  </div>
                  {/* A1 (F3): qty/price/remove group wraps at <sm so the row
                      stays inside the modal budget (~272px) instead of
                      overflowing horizontally. At sm+ the group is inline. */}
                  <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:flex-nowrap">
                    <div className="w-16 sm:w-20">
                      <FormField id={`qty-${idx}`} label={t("qty")} showLabel={idx === 0}>
                        <Input
                          type="number"
                          min="1"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))}
                          disabled={isPending}
                        />
                      </FormField>
                    </div>
                    <div className="w-20 sm:w-28">
                      <FormField
                        id={`price-${idx}`}
                        label={t("unitPrice")}
                        showLabel={idx === 0}
                        labelClassName="whitespace-nowrap"
                      >
                        <Input
                          type="number"
                          min="1"
                          value={li.unitPrice}
                          onChange={(e) => updateLineItem(idx, "unitPrice", Number(e.target.value))}
                          disabled={isPending}
                        />
                      </FormField>
                    </div>
                    {lineItems.length > 1 && (
                      <ActionIconButton
                        icon={Trash2}
                        label={t("remove")}
                        tone="danger"
                        onClick={() => removeLineItem(idx)}
                        disabled={isPending}
                        className="mb-0.5"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary + main actions.
              Mobile: third section (after line items). Desktop: right column, row 2,
              sticky at the bottom of the modal scroll area so the total and the
              create button are always reachable without scrolling. */}
          <div className="lg:col-start-2 lg:row-start-2 lg:sticky lg:bottom-0 lg:z-10 lg:border-t lg:border-surface-border lg:bg-surface-card lg:pt-4">
            <div className="mb-3 text-right text-sm font-medium text-zinc-900 dark:text-white">
              {t("total")} {formatAmount(total, currency, locale)}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={submitBlocked} loading={isPending}>
                {isPending ? t("creating") : t("createSale")}
              </Button>
              {(onDone || onCancel) && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending}
                  onClick={onCancel ?? onDone}
                >
                  {tCommon("cancel")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>

      <Modal
        open={showClientForm}
        onClose={() => setShowClientForm(false)}
        title={t("newClient")}
        size="sm"
      >
        <ClientForm onSuccess={handleClientCreated} />
      </Modal>

      <Modal
        open={showItemForm}
        onClose={() => setShowItemForm(false)}
        title={t("newItem")}
        size="sm"
      >
        <CatalogForm onDone={handleItemCreated} />
      </Modal>
    </div>
  );
}
