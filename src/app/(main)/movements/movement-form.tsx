'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { MOVEMENT_TYPES, MOVEMENT_CONTEXTS } from '../../../core/domain/movement';
import type { MovementType } from '../../../core/domain/movement';
import { CURRENCIES } from '../../../core/domain/currency';
import { createMovementAction } from './actions';
import { IdempotencyField } from '../../../components/ui/idempotency-field';
import type { SerializedCategory } from '../../../core/domain/category';
import type { SerializedAccount } from '../../../core/domain/account';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';
import {
  filterCategoriesByType,
  resolveDefaultAccountId,
} from '../../../lib/movement-form';
import { toDateInputValue } from '../../../lib/date';

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4">{children}</div>
    </fieldset>
  );
}

export function MovementForm({
  accounts,
  categories,
  defaultAccountId,
  defaultType,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  /** Account preselected via the movements table filter, if any. */
  defaultAccountId?: string;
  /** Preset movement type (income | expense), e.g. from the quick-action FAB. */
  defaultType?: MovementType;
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createMovementAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<MovementType>(
    defaultType ?? 'income',
  );
  const t = useT('Movements');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  const filteredCategories = filterCategoriesByType(categories, selectedType);

  return (
    <form action={formAction} className="space-y-5">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <FieldGroup title={t('groupSelection')}>
        <Select
          id="account"
          name="accountId"
          label={t('account')}
          required
          disabled={isPending}
          defaultValue={resolveDefaultAccountId(defaultAccountId, accounts)}
          placeholder={t('selectAccount')}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />

        <Select
          id="type"
          name="type"
          label={t('type')}
          required
          disabled={isPending}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as MovementType)}
          options={MOVEMENT_TYPES.map((mt) => ({
            value: mt,
            label: mt === 'income' ? t('income') : t('expense'),
          }))}
        />

        <Select
          id="categoryId"
          name="categoryId"
          label={t('category')}
          required
          disabled={isPending}
          options={filteredCategories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />

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
      </FieldGroup>

      <FieldGroup title={t('groupDetails')}>
        <Input
          id="amount"
          name="amount"
          type="number"
          label={t('amount')}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="currency"
          name="currency"
          label={t('currency')}
          required
          disabled={isPending}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />

        <Select
          id="context"
          name="context"
          label={t('context')}
          disabled={isPending}
          defaultValue="Personal"
          options={MOVEMENT_CONTEXTS.map((c) => ({
            value: c,
            label: c === 'Personal' ? t('personal') : t('business'),
          }))}
        />

        <div className="sm:col-span-2">
          <Input
            id="note"
            name="note"
            type="text"
            label={t('note')}
            disabled={isPending}
          />
        </div>
      </FieldGroup>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('creating') : t('addMovement')}
      </Button>
    </form>
  );
}
