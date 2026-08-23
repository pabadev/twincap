'use client';

import { useT } from '../../../i18n/client';
import { deleteAbonoAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteAbonoButton({
  payableId,
  abonoId,
}: {
  payableId: string;
  abonoId: string;
}) {
  const t = useT('Payables');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteAbonoAction}
      fields={{ payableId, abonoId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDeleteAbono')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
      stopPropagation
    />
  );
}
