'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../../i18n/client';
import { createCatalogItemAction, updateCatalogItemAction } from './actions';
import type { CatalogItem } from '../../../../core/domain/catalog';
import { CATALOG_ITEM_TYPES } from '../../../../core/domain/catalog';
import type { CatalogItemType } from '../../../../core/domain/catalog';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';

interface CatalogFormProps {
  item?: CatalogItem;
  onDone?: () => void;
}

export function CatalogForm({ item, onDone }: CatalogFormProps) {
  const isEdit = !!item;
  const t = useT('Catalog');
  const tCommon = useT('Common');

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateCatalogItemAction : createCatalogItemAction,
    null,
  );

  const [type, setType] = useState<CatalogItemType>(item?.type ?? 'product');
  const [currency, setCurrency] = useState<Currency>(item?.unitPrice.currency ?? DEFAULT_CURRENCY);

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
      {isEdit && <input type="hidden" name="itemId" value={item.id} />}

      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {t('name')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={item?.name}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="unitPrice"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('unitPrice', { currency })}
          </label>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="1"
            required
            defaultValue={item?.unitPrice.amount}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('currency')}
          </label>
          <select
            id="currency"
            name="currency"
            required
            disabled={isPending || isEdit}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('type')}
          </label>
          <select
            id="type"
            name="type"
            required
            disabled={isPending || isEdit}
            value={type}
            onChange={(e) => setType(e.target.value as CatalogItemType)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {CATALOG_ITEM_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {ct.charAt(0).toUpperCase() + ct.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {type === 'product' && (
          <div>
            <label
              htmlFor="stock"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('stock')}
            </label>
            <input
              id="stock"
              name="stock"
              type="number"
              min="0"
              required
              defaultValue={item?.stock ?? 0}
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending
            ? isEdit
              ? t('updating')
              : t('creating')
            : isEdit
              ? t('updateItem')
              : t('addBtn')}
        </button>
        {isEdit && onDone && (
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
