'use client';

import { useT } from '../../../../i18n/client';
import { deleteCreditAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteCreditButton({ creditId }: { creditId: string }) {
  const t = useT('CreditsGranted');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteCreditAction}
      fields={{ creditId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
      stopPropagation
    />
  );
}
