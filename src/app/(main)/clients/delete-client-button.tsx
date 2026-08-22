'use client';

import { useT } from '../../../i18n/client';
import { deleteClientAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const t = useT('Clients');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteClientAction}
      fields={{ clientId }}
      label={t('delete')}
      confirmTitle={t('confirmDelete')}
      confirmMessage={t('confirmDeleteMessage')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      variant="ghost"
      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
    />
  );
}
