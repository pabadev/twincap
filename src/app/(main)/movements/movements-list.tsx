'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedMovement } from '../../../core/domain/movement';
import { DeleteMovementButton } from './delete-movement-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { deriveSystemNote } from '../../../lib/system-note';
import { Select } from '../../../components/ui/select';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { ArrowLeftRight } from 'lucide-react';
import { useQuickMovement } from '../global-movement-provider';

export function MovementsList({
  accounts,
  movementsByAccount,
  refLabels = {},
}: {
  accounts: SerializedAccount[];
  movementsByAccount: Record<string, SerializedMovement[]>;
  /** Parent counterparty labels (credit/sale/payable id → name) for note derivation. */
  refLabels?: Record<string, string>;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  /** D3 scope filter — only meaningful while 'all accounts' is active. */
  const [selectedScope, setSelectedScope] = useState<'all' | 'Personal' | 'Business'>('all');
  const t = useT('Movements');
  const tCommon = useT('Common');
  const tSystemNotes = useT('SystemNotes');
  const locale = useLocale();
  const { openQuickMovement } = useQuickMovement();

  // D3: scope filter uses Movement.context (the source of truth).
  const allMovements = Object.values(movementsByAccount)
    .flat()
    .filter((m) =>
      selectedAccountId === 'all'
        ? selectedScope === 'all' || m.context === selectedScope
        : true,
    );
  const movements =
    selectedAccountId === 'all'
      ? allMovements
      : (movementsByAccount[selectedAccountId] ?? []);

  const sortedMovements = movements;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        {selectedAccountId && (
          <button
            onClick={() =>
              openQuickMovement(
                selectedAccountId === 'all'
                  ? undefined
                  : { accountId: selectedAccountId },
              )
            }
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {t('addMovement')}
          </button>
        )}
      </div>

      {/* Account selector + scope filter */}
      {accounts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="account-select"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('account')}
            </label>
            <Select
              id="account-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              options={[
                { value: 'all', label: t('allAccounts') },
                ...accounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${a.currency})`,
                })),
              ]}
            />
          </div>
          <div>
            <label
              htmlFor="scope-select"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('scope')}
            </label>
            {/* D3: with a specific account selected its scope governs — the
                Ámbito filter only applies while 'all accounts' is active. */}
            <Select
              id="scope-select"
              value={selectedScope}
              disabled={selectedAccountId !== 'all'}
              onChange={(e) =>
                setSelectedScope(e.target.value as typeof selectedScope)
              }
              options={[
                { value: 'all', label: t('scopeAll') },
                { value: 'Personal', label: t('scopePersonal') },
                { value: 'Business', label: t('scopeBusiness') },
              ]}
            />
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ArrowLeftRight} size="xl" />}
          title={t('emptyNoAccountsTitle')}
          description={t('emptyNoAccountsDescription')}
        />
      ) : (
        <>
          {sortedMovements.length === 0 ? (
            <EmptyState
              icon={<Icon icon={ArrowLeftRight} size="xl" />}
              title={t('emptyTitle')}
              description={
                selectedAccountId !== 'all'
                  ? t('emptyDescription')
                  : selectedScope !== 'all'
                    ? t('noMovementsScope')
                    : t('noMovementsAll')
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <table className="w-full min-w-[600px] divide-y divide-zinc-200 dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {tCommon('date')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {t('type')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {tCommon('note')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {tCommon('amount')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {tCommon('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {sortedMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatDate(movement.date, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            movement.type === 'income'
                              ? 'bg-income/10 text-income'
                              : 'bg-expense/10 text-expense'
                          }`}
                        >
                          {t(movement.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {movement.link
                          ? (deriveSystemNote(movement, tSystemNotes, refLabels) ?? movement.note) || '—'
                          : (movement.note || '—')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${
                            movement.type === 'income'
                              ? 'text-income'
                              : 'text-expense'
                          }`}
                        >
                          {movement.type === 'income' ? '+' : '−'}
                          {formatAmount(
                            movement.amount.amount,
                            movement.amount.currency,
                            locale,
                          )}{' '}
                          {movement.amount.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!movement.link && (
                          <DeleteMovementButton movementId={movement.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
