'use client';

import { useT } from '../../../../i18n/client';
import { deleteAbonoAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteAbonoButton({
  creditId,
  abonoId,
}: {
  creditId: string;
  abonoId: string;
}) {
  const t = useT('CreditsGranted');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteAbonoAction}
      fields={{ creditId, abonoId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDeleteAbono')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
      stopPropagation
    />
  );
}
