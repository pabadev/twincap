'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { deleteAccountAction } from './actions';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const t = useT('Accounts');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    deleteAccountAction,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <Button
        type="submit"
        variant="ghost"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        disabled={isPending}
        loading={isPending}
      >
        {t('delete')}
      </Button>
    </form>
  );
}
