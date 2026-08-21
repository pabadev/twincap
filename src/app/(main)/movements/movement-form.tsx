'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { MOVEMENT_TYPES, MOVEMENT_CONTEXTS } from '../../../core/domain/movement';
import { CURRENCIES } from '../../../core/domain/currency';
import { createMovementAction } from './actions';
import type { SerializedCategory } from '../../../core/domain/category';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';

export function MovementForm({
  accountId,
  categories,
  onSuccess,
}: {
  accountId: string;
  categories: SerializedCategory[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createMovementAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<string>('income');
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

  const filteredCategories = categories.filter((c) => c.type === selectedType);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />

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
