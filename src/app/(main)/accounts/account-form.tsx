'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { CURRENCIES } from '../../../core/domain/currency';
import { createAccountAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';

export function AccountForm() {
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    null,
  );
  const t = useT('Accounts');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.push('/accounts');
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        id="name"
        name="name"
        type="text"
        label={t('accountName')}
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
        id="initialBalance"
        name="initialBalance"
        type="number"
        label={t('initialBalance')}
        min="0"
        defaultValue="0"
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('creating') : t('createAccount')}
      </Button>
    </form>
  );
}
