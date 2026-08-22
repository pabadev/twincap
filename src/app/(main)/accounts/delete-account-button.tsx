'use client';

import { useT } from '../../../i18n/client';
import { deleteAccountAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

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
      icon={Trash2}
      iconOnly
    />
  );
}
