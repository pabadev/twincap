'use client';

import { useActionState, useState } from 'react';
import { MOVEMENT_TYPES, MOVEMENT_CONTEXTS } from '../../../core/domain/movement';
import { createMovementAction } from './actions';
import type { Category } from '../../../core/domain/category';

export function MovementForm({
  accountId,
  categories,
}: {
  accountId: string;
  categories: Category[];
}) {
  const [state, formAction, isPending] = useActionState(
    createMovementAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<string>('income');

  const filteredCategories = categories.filter((c) => c.type === selectedType);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />

      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="type"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Type
        </label>
        <select
          id="type"
          name="type"
          required
          disabled={isPending}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Amount (minor units)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="1"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="currency"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          <option value="COP">COP</option>
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="date"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="note"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Note
        </label>
        <input
          id="note"
          name="note"
          type="text"
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="context"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Context
        </label>
        <select
          id="context"
          name="context"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {MOVEMENT_CONTEXTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="categoryId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Add Movement'}
      </button>
    </form>
  );
}
