'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../i18n/client';
import { MOVEMENT_TYPES, MOVEMENT_CONTEXTS } from '../../../core/domain/movement';
import { CURRENCIES } from '../../../core/domain/currency';
import { createMovementAction } from './actions';
import type { Category } from '../../../core/domain/category';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';

export function MovementForm({
  accountId,
  categories,
}: {
  accountId: string;
  categories: Category[];
}) {
  const [state, formAction, isPending] = useActionState(
    createMovementAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<string>('income');
  const t = useT('Movements');

  const filteredCategories = categories.filter((c) => c.type === selectedType);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />

      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <Select
        id="type"
        name="type"
        label={t('type')}
        required
        disabled={isPending}
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        options={MOVEMENT_TYPES.map((mt) => ({
          value: mt,
          label: mt === 'income' ? t('income') : t('expense'),
        }))}
      />

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

      <Input
        id="date"
        name="date"
        type="date"
        label={t('date')}
        required
        disabled={isPending}
        defaultValue={new Date().toISOString().split('T')[0]}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t('note')}
        disabled={isPending}
      />

      <Select
        id="context"
        name="context"
        label={t('context')}
        required
        disabled={isPending}
        options={MOVEMENT_CONTEXTS.map((c) => ({
          value: c,
          label: c === 'Personal' ? t('personal') : t('business'),
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
