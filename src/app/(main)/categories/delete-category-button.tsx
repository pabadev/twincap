'use client';

import { deleteCategoryAction } from './actions';

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  return (
    <form
      action={deleteCategoryAction}
      onSubmit={(e) => {
        if (!confirm('Delete this category? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>
    </form>
  );
}
