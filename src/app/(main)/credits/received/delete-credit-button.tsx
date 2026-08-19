'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../../../i18n/client';
import { deleteCreditAction } from './actions';
import { useToast } from '../../../../lib/hooks/use-toast';

export function DeleteCreditButton({ creditId }: { creditId: string }) {
  const t = useT('CreditsReceived');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    deleteCreditAction,
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
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="creditId" value={creditId} />
      <button
        type="submit"
        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        disabled={isPending}
      >
        {tCommon('delete')}
      </button>
    </form>
  );
}
