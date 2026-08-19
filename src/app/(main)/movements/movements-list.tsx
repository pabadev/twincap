'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { Account } from '../../../core/domain/account';
import type { Movement } from '../../../core/domain/movement';
import type { Category } from '../../../core/domain/category';
import { MovementForm } from './movement-form';
import { DeleteMovementButton } from './delete-movement-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { Select } from '../../../components/ui/select';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { Modal } from '../../../components/ui/modal';
import { ArrowLeftRight } from 'lucide-react';

export function MovementsList({
  accounts,
  movementsByAccount,
  categories,
}: {
  accounts: Account[];
  movementsByAccount: Record<string, Movement[]>;
  categories: Category[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const t = useT('Movements');
  const tCommon = useT('Common');
  const locale = useLocale();

  const allMovements = Object.values(movementsByAccount).flat();
  const movements = selectedAccountId === 'all'
    ? allMovements
    : (movementsByAccount[selectedAccountId] ?? []);

  // Sort by date descending
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        {selectedAccountId && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {t('addMovement')}
          </button>
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newMovement')}
      >
        {selectedAccountId === 'all' ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('selectAccountToAdd')}
          </p>
        ) : (
          <MovementForm
            accountId={selectedAccountId}
            categories={categories}
          />
        )}
      </Modal>

      {/* Account selector */}
      {accounts.length > 0 && (
        <div className="mb-6">
          <label
            htmlFor="account-select"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('account')}
          </label>
          <Select
            id="account-select"
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setShowForm(false);
            }}
            options={[
              { value: 'all', label: t('allAccounts') },
              ...accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.currency})`,
              })),
            ]}
          />
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
              title={selectedAccountId === 'all' ? t('emptyTitle') : t('emptyTitle')}
              description={selectedAccountId === 'all' ? t('noMovementsAll') : t('emptyDescription')}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <table className="min-w-[600px] divide-y divide-zinc-200 dark:divide-zinc-700">
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
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {movement.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {movement.note || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${
                            movement.type === 'income'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
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
