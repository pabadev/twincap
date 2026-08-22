'use client';

import { useT } from '../../../i18n/client';
import { deleteCategoryAction } from './actions';
import { EntityDeleteButton } from '../../../components/ui/entity-delete-button';
import { Trash2 } from 'lucide-react';

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const t = useT('Categories');
  const tCommon = useT('Common');

  return (
    <EntityDeleteButton
      action={deleteCategoryAction}
      fields={{ categoryId }}
      label={tCommon('delete')}
      confirmTitle={t('confirmDelete')}
      cancelLabel={tCommon('cancel')}
      icon={Trash2}
      variant="ghost"
      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
    />
  );
}
