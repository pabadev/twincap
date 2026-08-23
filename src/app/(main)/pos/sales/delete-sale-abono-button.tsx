'use client';

import { useT } from '../../../../i18n/client';
import { deleteSaleAbonoAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteSaleAbonoButton({
  saleId,
  abonoId,
  onDeleted,
}: {
  saleId: string;
  abonoId: string;
  /** Optional callback fired after a successful deletion. */
  onDeleted?: () => void;
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
      onSuccess={onDeleted}
    />
  );
}
