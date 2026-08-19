'use client';

import { useT } from '../../../i18n/client';
import { deleteClientAction } from './actions';
import { Button } from '../../../components/ui/button';

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const t = useT('Clients');

  return (
    <form
      action={deleteClientAction}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
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
