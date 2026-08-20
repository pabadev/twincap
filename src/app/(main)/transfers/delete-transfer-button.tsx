'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { deleteTransferAction } from './actions';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { useToast } from '../../../lib/hooks/use-toast';
import { Trash2 } from 'lucide-react';

export function DeleteTransferButton({ transferId }: { transferId: string }) {
  const t = useT('Transfers');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);
  const [state, formAction, isPending] = useActionState(
    deleteTransferAction,
    null,
  );

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
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
      <input type="hidden" name="transferId" value={transferId} />
      <Button
        type="submit"
        variant="ghost"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        disabled={isPending}
        loading={isPending}
        aria-label={t('delete')}
      >
        <Icon icon={Trash2} size="sm" />
        {t('delete')}
      </Button>
    </form>
  );
}
