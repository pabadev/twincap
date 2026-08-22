'use client';

import { useT } from '../../../i18n/client';
import { deleteMovementAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteMovementButton({ movementId }: { movementId: string }) {
  const t = useT('Movements');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteMovementAction}
      fields={{ movementId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
    />
  );
}
