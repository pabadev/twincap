'use client';

import { useT } from '../../../i18n/client';
import { deleteCategoryAction } from './actions';

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const t = useT('Categories');

  return (
    <form
      action={deleteCategoryAction}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        {t('delete')}
      </button>
    </form>
  );
}
