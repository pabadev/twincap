'use client';

import { useT } from '../../../../i18n/client';
import { deleteSaleAbonoAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteSaleAbonoButton({
  saleId,
  abonoId,
}: {
  saleId: string;
  abonoId: string;
}) {
  const t = useT('Sales');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteSaleAbonoAction}
      fields={{ saleId, abonoId }}
      label={t('remove')}
      confirmTitle={t('confirmDeleteAbono')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
    />
  );
}
