'use client';

import { useT } from '../../../../i18n/client';
import { deleteCatalogItemAction } from './actions';
import { EntityDeleteButton } from '../../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteCatalogItemButton({ itemId }: { itemId: string }) {
  const t = useT('Catalog');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteCatalogItemAction}
      fields={{ itemId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      iconOnly
    />
  );
}
