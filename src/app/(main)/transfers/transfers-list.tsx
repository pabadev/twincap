'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { Account } from '../../../core/domain/account';
import type { Transfer } from '../../../core/domain/transfer';
import { TransferForm } from './transfer-form';
import { DeleteTransferButton } from './delete-transfer-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { Modal } from '../../../components/ui/modal';
import { ArrowRightLeft } from 'lucide-react';

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
  const t = useT('Transfers');
  const tCommon = useT('Common');
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {t('addTransfer')}
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newTransfer')}
      >
        <TransferForm accounts={accounts} onSuccess={() => setShowForm(false)} />
      </Modal>

      {transfers.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ArrowRightLeft} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-[700px] divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {tCommon('date')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('fromTo')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('amounts')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {tCommon('note')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(transfer.date, locale)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {accountName(accounts, transfer.sourceAccountId)}
                    {' → '}
                    {accountName(accounts, transfer.destinationAccountId)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="text-red-600 dark:text-red-400">
                      −{formatAmount(transfer.sourceAmount.amount, transfer.sourceAmount.currency, locale)} {transfer.sourceAmount.currency}
                    </span>
                    {' → '}
                    <span className="text-green-600 dark:text-green-400">
                      +{formatAmount(transfer.destinationAmount.amount, transfer.destinationAmount.currency, locale)} {transfer.destinationAmount.currency}
                    </span>
                    {transfer.rate && (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({t('rate')}: {transfer.rate})
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
