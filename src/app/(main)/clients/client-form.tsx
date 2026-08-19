'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { createClientAction } from './actions';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';

export function ClientForm() {
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    null,
  );
  const t = useT('Clients');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.push('/clients');
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
