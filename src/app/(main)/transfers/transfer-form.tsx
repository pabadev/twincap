'use client';

import { useActionState, useState } from 'react';
import { createTransferAction } from './actions';
import type { Account } from '../../../core/domain/account';

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(
    createTransferAction,
    null,
  );

  const [sourceCurrency, setSourceCurrency] = useState(accounts[0]?.currency ?? 'COP');
  const [destCurrency, setDestCurrency] = useState(accounts[0]?.currency ?? 'COP');
  const isCrossCurrency = sourceCurrency !== destCurrency;

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="sourceAccountId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          From Account
        </label>
        <select
          id="sourceAccountId"
          name="sourceAccountId"
          required
          disabled={isPending}
          onChange={(e) => {
            const acc = accounts.find((a) => a.id === e.target.value);
            if (acc) setSourceCurrency(acc.currency);
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="destinationAccountId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          To Account
        </label>
        <select
          id="destinationAccountId"
          name="destinationAccountId"
          required
          disabled={isPending}
          onChange={(e) => {
            const acc = accounts.find((a) => a.id === e.target.value);
            if (acc) setDestCurrency(acc.currency);
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="sourceAmount"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Source Amount ({sourceCurrency})
          </label>
          <input
            id="sourceAmount"
            name="sourceAmount"
            type="number"
            min="1"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
          <input type="hidden" name="sourceCurrency" value={sourceCurrency} />
        </div>

        {isCrossCurrency && (
          <div>
            <label
              htmlFor="destinationAmount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Dest Amount ({destCurrency})
            </label>
            <input
              id="destinationAmount"
              name="destinationAmount"
              type="number"
              min="1"
              required
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            />
            <input type="hidden" name="destinationCurrency" value={destCurrency} />
          </div>
        )}
      </div>

      {isCrossCurrency && (
        <div>
          <label
            htmlFor="rate"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            FX Rate ({sourceCurrency} → {destCurrency})
          </label>
          <input
            id="rate"
            name="rate"
            type="number"
            step="0.01"
            min="0"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      )}

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

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Add Transfer'}
      </button>
    </form>
  );
}
