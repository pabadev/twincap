'use client';

import { useActionState } from 'react';
import { useT } from '../../../i18n/client';
import { CATEGORY_TYPES } from '../../../core/domain/category';
import { createCategoryAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';

export function CategoryForm() {
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    null,
  );
  const t = useT('Categories');

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <Input
        id="name"
        name="name"
        type="text"
        label={t('categoryName')}
        required
        disabled={isPending}
      />

      <Select
        id="type"
        name="type"
        label={t('type')}
        required
        disabled={isPending}
        options={CATEGORY_TYPES.map((ct) => ({
          value: ct,
          label: ct === 'income' ? t('income') : t('expense'),
        }))}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('creating') : t('createCategory')}
      </Button>
    </form>
  );
}
