'use client';

import { useActionState } from 'react';
import { useT } from '../../../i18n/client';
import { CATEGORY_TYPES } from '../../../core/domain/category';
import { createCategoryAction } from './actions';

export function CategoryForm() {
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    null,
  );
  const t = useT('Categories');

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {t('categoryName')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="type"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {t('type')}
        </label>
        <select
          id="type"
          name="type"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {CATEGORY_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {ct === 'income' ? t('income') : t('expense')}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? t('creating') : t('createCategory')}
      </button>
    </form>
  );
}
