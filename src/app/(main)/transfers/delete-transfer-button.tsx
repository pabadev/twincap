'use client';

import { useT } from '../../../i18n/client';
import { deleteTransferAction } from './actions';
import { Button } from '../../../components/ui/button';

export function DeleteTransferButton({ transferId }: { transferId: string }) {
  const t = useT('Transfers');

  return (
    <form
      action={deleteTransferAction}
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
      >
        {t('delete')}
      </Button>
    </form>
  );
}
