'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { CATEGORY_TYPES } from '../../../core/domain/category';
import { createCategoryAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';

export function CategoryForm() {
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    null,
  );
  const t = useT('Categories');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.push('/categories');
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(state.error, 'error');
    }
  }, [state?.error, addToast]);

  return (
    <form action={formAction} className="space-y-4">
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
