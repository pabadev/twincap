'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../../i18n/client';
import { createCatalogItemAction, updateCatalogItemAction } from './actions';
import type { CatalogItem } from '../../../../core/domain/catalog';
import { CATALOG_ITEM_TYPES } from '../../../../core/domain/catalog';
import type { CatalogItemType } from '../../../../core/domain/catalog';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';

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

      <Input
        id="name"
        name="name"
        type="text"
        label={t('name')}
        required
        defaultValue={item?.name}
        disabled={isPending}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="unitPrice"
          name="unitPrice"
          type="number"
          label={t('unitPrice', { currency })}
          min="1"
          required
          defaultValue={item?.unitPrice.amount}
          disabled={isPending}
        />

        <Select
          id="currency"
          name="currency"
          label={t('currency')}
          required
          disabled={isPending || isEdit}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="type"
          name="type"
          label={t('type')}
          required
          disabled={isPending || isEdit}
          value={type}
          onChange={(e) => setType(e.target.value as CatalogItemType)}
          options={CATALOG_ITEM_TYPES.map((ct) => ({
            value: ct,
            label: t(`type_${ct}`),
          }))}
        />

        {type === 'product' && (
          <Input
            id="stock"
            name="stock"
            type="number"
            label={t('stock')}
            min="0"
            required
            defaultValue={item?.stock ?? 0}
            disabled={isPending}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          loading={isPending}
        >
          {isPending
            ? isEdit
              ? t('updating')
              : t('creating')
            : isEdit
              ? t('updateItem')
              : t('addBtn')}
        </Button>
        {isEdit && onDone && (
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
