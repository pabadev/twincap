'use client';

import { useActionState } from 'react';
import { addSaleAbonoAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';

interface AbonoFormProps {
  saleId: string;
  accounts: Account[];
  onDone?: () => void;
}

export function AbonoForm({ saleId, accounts, onDone }: AbonoFormProps) {
  const [state, formAction, isPending] = useActionState(addSaleAbonoAction, null);

  const currency: Currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (isPending) {
          e.preventDefault();
          return;
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="currency" value={currency} />

      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount ({currency})
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
          <label htmlFor="accountId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Account
          </label>
          <select
            id="accountId"
            name="accountId"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            disabled={isPending}
            defaultValue={new Date().toISOString().split('T')[0]}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? 'Adding...' : 'Add Payment'}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
