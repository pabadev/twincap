'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { createCatalogItemAction, updateCatalogItemAction } from './actions';
import type { SerializedCatalogItem } from '../../../../core/domain/catalog';
import { CATALOG_ITEM_TYPES } from '../../../../core/domain/catalog';
import type { CatalogItemType } from '../../../../core/domain/catalog';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { useActionError } from '../../../../lib/use-action-error';

interface CatalogFormProps {
  item?: SerializedCatalogItem;
  /** Called after a successful save; a create passes the created item snapshot (when available). */
  onDone?: (item?: SerializedCatalogItem) => void;
}

export function CatalogForm({ item, onDone }: CatalogFormProps) {
  const isEdit = !!item;
  const t = useT('Catalog');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateCatalogItemAction : createCatalogItemAction,
    null,
  );

  const [type, setType] = useState<CatalogItemType>(item?.type ?? 'product');
  const [currency, setCurrency] = useState<Currency>(item?.unitPrice.currency ?? DEFAULT_CURRENCY);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      router.refresh();
      onDone?.(state.item);
    }
  }, [state?.success, state?.item, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), 'error');
    }
  }, [state?.error, addToast, translateError]);

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
        <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {translateError(state.error)}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            onClick={() => onDone()}
          >
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
