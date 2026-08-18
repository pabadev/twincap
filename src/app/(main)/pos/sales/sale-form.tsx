'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../../i18n/client';
import { createSaleAction } from './actions';
import type { CatalogItem } from '../../../../core/domain/catalog';
import type { Account } from '../../../../core/domain/account';
import type { PaymentMode } from '../../../../core/domain/sale';
import { PAYMENT_MODES } from '../../../../core/domain/sale';
import { DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';

interface LineItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

interface SaleFormProps {
  catalogItems: CatalogItem[];
  accounts: Account[];
  onDone?: () => void;
}

export function SaleForm({ catalogItems, accounts, onDone }: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(createSaleAction, null);
  const t = useT('Sales');
  const tCommon = useT('Common');

  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('paid-in-full');
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
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
      <input type="hidden" name="currency" value={currency} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="paymentMode" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('paymentMode')}
          </label>
          <select
            id="paymentMode"
            name="paymentMode"
            required
            disabled={isPending}
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m === 'paid-in-full' ? t('paidInFull') : t('onCredit')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="accountId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('account')}
          </label>
          <select
            id="accountId"
            name="accountId"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('date')}
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          disabled={isPending}
          defaultValue={new Date().toISOString().split('T')[0]}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('lineItems')}
          </label>
          <button
            type="button"
            onClick={addLineItem}
            disabled={isPending}
            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t('addItem')}
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                {idx === 0 && (
                  <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{t('item')}</label>
                )}
                <select
                  value={li.itemId}
                  onChange={(e) => handleItemSelect(idx, e.target.value)}
                  disabled={isPending}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                >
                  {catalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                {idx === 0 && (
                  <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{t('qty')}</label>
                )}
                <input
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                  disabled={isPending}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div className="w-28">
                {idx === 0 && (
                  <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{t('unitPrice')}</label>
                )}
                <input
                  type="number"
                  min="1"
                  value={li.unitPrice}
                  onChange={(e) => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                  disabled={isPending}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLineItem(idx)}
                  disabled={isPending}
                  className="mb-0.5 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  {t('remove')}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 text-right text-sm font-medium text-zinc-900 dark:text-white">
          {t('total')} {total.toLocaleString()} {currency}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? t('creating') : t('createSale')}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {tCommon('cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
