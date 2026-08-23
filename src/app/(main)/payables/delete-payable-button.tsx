'use client';

import { useT } from '../../../i18n/client';
import { deletePayableAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeletePayableButton({ payableId }: { payableId: string }) {
  const t = useT('Payables');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deletePayableAction}
      fields={{ payableId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
      stopPropagation
    />
  );
}
