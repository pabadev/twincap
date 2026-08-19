'use client';

import { useT } from '../../../i18n/client';
import { deleteAccountAction } from './actions';
import { Button } from '../../../components/ui/button';

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const t = useT('Accounts');

  return (
    <form
      action={deleteAccountAction}
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
      >
        {t('delete')}
      </Button>
    </form>
  );
}
