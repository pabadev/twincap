'use client';

import { useT } from '../../../i18n/client';
import { deleteAccountAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const t = useT('Accounts');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteAccountAction}
      fields={{ accountId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      variant="ghost"
      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
    />
  );
}
