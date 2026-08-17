'use client';

import { useState } from 'react';
import type { Account } from '../../../core/domain/account';
import type { Transfer } from '../../../core/domain/transfer';
import { TransferForm } from './transfer-form';
import { DeleteTransferButton } from './delete-transfer-button';

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  const exp = currency === 'COP' ? 0 : 2;
  const divisor = 10 ** exp;
  const value = amount / divisor;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
}

function accountName(accounts: Account[], id: string): string {
  const acc = accounts.find((a) => a.id === id);
  return acc ? `${acc.name} (${acc.currency})` : id;
}

export function TransfersList({
  accounts,
  transfers,
}: {
  accounts: Account[];
  transfers: Transfer[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Transfers
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {showForm ? 'Cancel' : 'Add Transfer'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            New Transfer
          </h2>
          <TransferForm accounts={accounts} />
        </div>
      )}

      {transfers.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No transfers yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  From → To
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Amounts
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Note
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(transfer.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {accountName(accounts, transfer.sourceAccountId)}
                    {' → '}
                    {accountName(accounts, transfer.destinationAccountId)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="text-red-600 dark:text-red-400">
                      −{formatAmount(transfer.sourceAmount.amount, transfer.sourceAmount.currency)} {transfer.sourceAmount.currency}
                    </span>
                    {' → '}
                    <span className="text-green-600 dark:text-green-400">
                      +{formatAmount(transfer.destinationAmount.amount, transfer.destinationAmount.currency)} {transfer.destinationAmount.currency}
                    </span>
                    {transfer.rate && (
                      <span className="ml-1 text-xs text-zinc-400">
                        (rate: {transfer.rate})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    {transfer.note || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteTransferButton transferId={transfer.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
