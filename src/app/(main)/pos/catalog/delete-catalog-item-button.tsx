'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { deleteCatalogItemAction } from './actions';
import { useToast } from '../../../../lib/hooks/use-toast';

export function DeleteCatalogItemButton({ itemId }: { itemId: string }) {
  const t = useT('Catalog');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    deleteCatalogItemAction,
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
      addToast(state.error, 'error');
    }
  }, [state?.error, addToast]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
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
