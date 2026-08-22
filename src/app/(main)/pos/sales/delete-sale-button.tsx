'use client';

import { useT } from '../../../../i18n/client';
import { deleteSaleAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteSaleButton({ saleId }: { saleId: string }) {
  const t = useT('Sales');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteSaleAction}
      fields={{ saleId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDeleteSale')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
    />
  );
}
