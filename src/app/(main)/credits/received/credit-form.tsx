'use client';

import { useActionState, useState } from 'react';
import { createCreditReceivedAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';

export function CreditForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(
    createCreditReceivedAction,
    null,
  );

  const [currency, setCurrency] = useState<Currency>(accounts[0]?.currency ?? DEFAULT_CURRENCY);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="counterparty"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Counterparty (Lender)
        </label>
        <input
          id="counterparty"
          name="counterparty"
          type="text"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="principal"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Principal ({currency})
          </label>
          <input
            id="principal"
            name="principal"
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
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="accountId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Receiving Account
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
              {a.name} ({a.currency})
            </option>
          ))}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="installments"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Installments (optional)
          </label>
          <input
            id="installments"
            name="installments"
            type="number"
            min="1"
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="frequency"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Frequency (optional)
          </label>
          <select
            id="frequency"
            name="frequency"
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">—</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Add Credit Received'}
      </button>
    </form>
  );
}
