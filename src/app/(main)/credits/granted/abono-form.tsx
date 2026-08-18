'use client';

import { useActionState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import { addAbonoAction } from './actions';
import type { Account } from '../../../../core/domain/account';

function formatAmount(amount: number, currency: string, locale?: string): string {
  const exp = currency === 'COP' ? 0 : 2;
  const divisor = 10 ** exp;
  const value = amount / divisor;
  return value.toLocaleString(locale, {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
}

export function AbonoForm({
  creditId,
  pending,
  currency,
  accounts,
}: {
  creditId: string;
  pending: number;
  currency: string;
  accounts: Account[];
}) {
  const [state, formAction, isPending] = useActionState(
    addAbonoAction,
    null,
  );
  const t = useT('CreditsGranted');
  const locale = useLocale();

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="currency" value={currency} />

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('pending')} {formatAmount(pending, currency, locale)} {currency}
      </p>

      {state?.error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label
            htmlFor={`amount-${creditId}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('amount')}
          </label>
          <input
            id={`amount-${creditId}`}
            name="amount"
            type="number"
            min="1"
            max={pending}
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor={`accountId-${creditId}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('account')}
          </label>
          <select
            id={`accountId-${creditId}`}
            name="accountId"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`date-${creditId}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('date')}
          </label>
          <input
            id={`date-${creditId}`}
            name="date"
            type="date"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? t('adding') : t('addAbono')}
      </button>
    </form>
  );
}
