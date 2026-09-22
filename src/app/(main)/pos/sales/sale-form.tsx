"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  onDone?: () => void;
}

export function SaleForm({ catalogItems, accounts, clients, onDone }: SaleFormProps) {
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

  // Quick-create from inside the sale form: auto-select the new entity so the
  // user can keep building the sale without leaving the form.
  function handleClientCreated(client?: SerializedClient) {
    setShowClientForm(false);
    if (client) setClientId(client.id);
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                ...clients.map((c) => ({
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

        <div>
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
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
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
                  <FormField id={`price-${idx}`} label={t("unitPrice")} showLabel={idx === 0}>
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
            ))}
          </div>

          <div className="mt-2 text-right text-sm font-medium text-zinc-900 dark:text-white">
            {t("total")} {formatAmount(total, currency, locale)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={submitBlocked} loading={isPending}>
            {isPending ? t("creating") : t("createSale")}
          </Button>
          {onDone && (
            <Button type="button" variant="secondary" disabled={isPending} onClick={onDone}>
              {tCommon("cancel")}
            </Button>
          )}
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
