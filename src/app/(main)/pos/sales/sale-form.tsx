'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../../../i18n/client';
import { createSaleAction } from './actions';
import type { SerializedCatalogItem } from '../../../../core/domain/catalog';
import type { SerializedAccount } from '../../../../core/domain/account';
import type { SerializedClient } from '../../../../core/domain/client';
import type { PaymentMode } from '../../../../core/domain/sale';
import { PAYMENT_MODES } from '../../../../core/domain/sale';
import { DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { formatAmount } from '../../../../lib/format';
import { toDateInputValue } from '../../../../lib/date';

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
  const t = useT('Sales');
  const tCommon = useT('Common');
  const tCatalog = useT('Catalog');
  const tToast = useT('Toast');
  const tError = useT('error');
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      router.refresh();
      onDone?.();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('paid-in-full');
  const [clientId, setClientId] = useState<string>(''); // empty = general client
  const [initialPayment, setInitialPayment] = useState<string>('0');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemId: catalogItems[0]?.id ?? '', quantity: 1, unitPrice: catalogItems[0]?.unitPrice.amount ?? 0 },
  ]);

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item,
    ));
  }

  function addLineItem() {
    setLineItems(prev => [
      ...prev,
      { itemId: catalogItems[0]?.id ?? '', quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  }

  function handleItemSelect(index: number, itemId: string) {
    const item = catalogItems.find(c => c.id === itemId);
    if (item) {
      setLineItems(prev => prev.map((li, idx) =>
        idx === index ? { ...li, itemId, unitPrice: item.unitPrice.amount } : li,
      ));
      setCurrency(item.unitPrice.currency);
    }
  }

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  // H14: on-credit sales require a real client and a valid upfront payment.
  const isOnCredit = paymentMode === 'on-credit';
  const parsedInitialPayment = Number(initialPayment) || 0;
  const needsClient = isOnCredit && !clientId;
  const initialPaymentInvalid =
    isOnCredit &&
    (!Number.isFinite(parsedInitialPayment) ||
      parsedInitialPayment < 0 ||
      parsedInitialPayment > total);
  const submitBlocked = isPending || needsClient || initialPaymentInvalid;

  return (
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
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      {state?.error && (
        <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {tToast(state.error)}
        </div>
      )}

      <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="paymentMode"
          name="paymentMode"
          label={t('paymentMode')}
          required
          disabled={isPending}
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          options={PAYMENT_MODES.map((m) => ({
            value: m,
            label: m === 'paid-in-full' ? t('paidInFull') : t('onCredit'),
          }))}
        />

        <Select
          id="accountId"
          name="accountId"
          label={t('account')}
          required
          disabled={isPending}
          placeholder={tCommon('select')}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />
      </div>

      <div>
        <Select
          id="clientId"
          label={`${t('client')}${isOnCredit ? ' *' : ''}`}
          disabled={isPending}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          options={[
            { value: '', label: t('generalClient') },
            ...clients.map((c) => ({
              value: c.id,
              label: c.name,
            })),
          ]}
        />
        {needsClient && (
          <p className="mt-1 text-xs text-warning">
            {t('clientRequiredForCredit')}
          </p>
        )}
      </div>

      {isOnCredit && (
        <div>
          <Input
            id="initialPayment"
            name="initialPayment"
            type="number"
            label={`${t('initialPayment')} (${currency})`}
            min="0"
            required
            disabled={isPending}
            value={initialPayment}
            onChange={(e) => setInitialPayment(e.target.value)}
            aria-invalid={initialPaymentInvalid || undefined}
          />
          {initialPaymentInvalid && (
            <p className="mt-1 text-xs text-danger">
              {parsedInitialPayment > total
                ? t('initialPaymentExceedsTotal')
                : tError('invalidData')}
            </p>
          )}
        </div>
      )}

      <Input
        id="date"
        name="date"
        type="date"
        label={t('date')}
        required
        disabled={isPending}
        defaultValue={toDateInputValue()}
        max={toDateInputValue()}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('lineItems')}
          </label>
          <button
            type="button"
            onClick={addLineItem}
            disabled={isPending}
            className="text-xs text-primary hover:text-primary-hover dark:text-primary"
          >
            {t('addItem')}
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                {idx === 0 && (
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('item')}</label>
                )}
                <Select
                  id={`item-${idx}`}
                  value={li.itemId}
                  onChange={(e) => handleItemSelect(idx, e.target.value)}
                  disabled={isPending}
                  placeholder={tCommon('select')}
                  options={catalogItems.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${tCatalog(`type_${item.type}`)})`,
                  }))}
                />
              </div>
              <div className="w-16 sm:w-20">
                {idx === 0 && (
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('qty')}</label>
                )}
                <Input
                  id={`qty-${idx}`}
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                  disabled={isPending}
                />
              </div>
              <div className="w-20 sm:w-28">
                {idx === 0 && (
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('unitPrice')}</label>
                )}
                <Input
                  id={`price-${idx}`}
                  type="number"
                  min="1"
                  value={li.unitPrice}
                  onChange={(e) => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                  disabled={isPending}
                />
              </div>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLineItem(idx)}
                  disabled={isPending}
                  className="mb-0.5 text-xs text-danger hover:text-danger/80"
                >
                  {t('remove')}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 text-right text-sm font-medium text-zinc-900 dark:text-white">
          {t('total')} {formatAmount(total, currency, locale)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={submitBlocked}
          loading={isPending}
        >
          {isPending ? t('creating') : t('createSale')}
        </Button>
        {onDone && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onDone}
          >
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
