'use client';

import { useActionState } from 'react';
import { useT } from '../../../i18n/client';
import { CURRENCIES } from '../../../core/domain/currency';
import { createAccountAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';

export function AccountForm() {
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    null,
  );
  const t = useT('Accounts');

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
