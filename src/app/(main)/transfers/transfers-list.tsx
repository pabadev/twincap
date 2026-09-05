'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedTransfer } from '../../../core/domain/transfer';
import { TransferForm } from './transfer-form';
import { DeleteTransferButton } from './delete-transfer-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { BackButton } from '../../../components/ui/back-button';
import { ActionIconButton } from '../../../components/ui/action-icon-button';
import { Table, TableShell, THead, Th, TBody, Td } from '../../../components/ui/table';
import { ArrowRightLeft, Pencil } from 'lucide-react';

function accountName(accounts: SerializedAccount[], id: string): string {
  const acc = accounts.find((a) => a.id === id);
  return acc ? `${acc.name} (${acc.currency})` : id;
}

export function TransfersList({
  accounts,
  transfers,
}: {
  accounts: SerializedAccount[];
  transfers: SerializedTransfer[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<SerializedTransfer | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const t = useT('Transfers');
  const tCommon = useT('Common');
  const locale = useLocale();

  const filtered = transfers.filter((transfer) => {
    if (dateFrom && new Date(transfer.date).getTime() < new Date(dateFrom).getTime()) return false;
    if (dateTo && new Date(transfer.date).getTime() > new Date(dateTo + 'T23:59:59.999Z').getTime()) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          {t('addTransfer')}
        </Button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newTransfer')}
      >
        <TransferForm accounts={accounts} onSuccess={() => setShowForm(false)} />
      </Modal>

      <Modal
        open={!!editingTransfer}
        onClose={() => setEditingTransfer(null)}
        title={t('editTitle')}
      >
        {editingTransfer && (
          <TransferForm
            accounts={accounts}
            transfer={editingTransfer}
            onSuccess={() => setEditingTransfer(null)}
          />
        )}
      </Modal>

      {transfers.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ArrowRightLeft} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('filterDateFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('filterDateTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
              />
            </div>
          </div>

          {filtered.length === 0 && transfers.length > 0 && (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {tCommon('noResults')}
            </p>
          )}

          <TableShell>
            <Table className="min-w-[700px]">
              <THead>
                <tr>
                  <Th>
                    {tCommon('date')}
                  </Th>
                  <Th>
                    {t('fromTo')}
                  </Th>
                  <Th align="right">
                    {tCommon('amount')}
                  </Th>
                  <Th align="right">
                    {tCommon('note')}
                  </Th>
                  <Th align="right">
                    {tCommon('actions')}
                  </Th>
                </tr>
              </THead>
              <TBody>
                {filtered.map((transfer) => (
                <tr key={transfer.id}>
                  <Td className="text-sm whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatDate(transfer.date, locale)}
                  </Td>
                  <Td className="max-w-[280px] truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {accountName(accounts, transfer.sourceAccountId)}
                    {' → '}
                    {accountName(accounts, transfer.destinationAccountId)}
                  </Td>
                  {transfer.sourceCurrency === transfer.destinationCurrency ? (
                    <Td align="right" className="text-sm font-medium whitespace-nowrap text-zinc-900 dark:text-white">
                      {formatAmount(transfer.sourceAmount.amount, transfer.sourceAmount.currency, locale)}
                    </Td>
                  ) : (
                    <Td align="right">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {formatAmount(transfer.sourceAmount.amount, transfer.sourceAmount.currency, locale)}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatAmount(transfer.destinationAmount.amount, transfer.destinationAmount.currency, locale)}
                        {transfer.rate && (
                          <span className="ml-1 text-xs font-normal text-zinc-400">
                            ({t('rate')}: {transfer.rate})
                          </span>
                        )}
                      </div>
                    </Td>
                  )}
                  <Td align="right" className="max-w-[200px] text-sm text-zinc-600 dark:text-zinc-400">
                    {transfer.note || '—'}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionIconButton
                        icon={Pencil}
                        label={tCommon('edit')}
                        tone="primary"
                        onClick={() => setEditingTransfer(transfer)}
                      />
                      <DeleteTransferButton transferId={transfer.id} />
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
            </Table>
          </TableShell>
        </>
      )}
    </div>
  );
}
