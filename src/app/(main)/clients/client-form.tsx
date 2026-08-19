'use client';

import { useActionState } from 'react';
import { useT } from '../../../i18n/client';
import { createClientAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

export function ClientForm() {
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    null,
  );
  const t = useT('Clients');

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
        label={t('name')}
        required
        disabled={isPending}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        label={t('phone')}
        disabled={isPending}
      />

      <Input
        id="email"
        name="email"
        type="email"
        label={t('email')}
        disabled={isPending}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t('note')}
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('adding') : t('newClient')}
      </Button>
    </form>
  );
}
