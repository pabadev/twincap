'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { deleteSaleAbonoAction } from './actions';
import { Icon } from '../../../../components/ui/icon';
import { useToast } from '../../../../lib/hooks/use-toast';
import { Trash2 } from 'lucide-react';

export function DeleteSaleAbonoButton({
  saleId,
  abonoId,
}: {
  saleId: string;
  abonoId: string;
}) {
  const t = useT('Sales');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);
  const [state, formAction, isPending] = useActionState(
    deleteSaleAbonoAction,
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
        if (!confirm(t('confirmDeleteAbono'))) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="abonoId" value={abonoId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        disabled={isPending}
        aria-label={t('remove')}
      >
        <Icon icon={Trash2} size="sm" />
        {t('remove')}
      </button>
    </form>
  );
}
