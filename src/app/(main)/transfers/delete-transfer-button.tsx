'use client';

import { useT } from '../../../i18n/client';
import { deleteTransferAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteTransferButton({ transferId }: { transferId: string }) {
  const t = useT('Transfers');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteTransferAction}
      fields={{ transferId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
    />
  );
}
