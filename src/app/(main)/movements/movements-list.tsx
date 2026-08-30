'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useT, useLocale } from '../../../i18n/client';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedMovement } from '../../../core/domain/movement';
import type { SerializedCategory } from '../../../core/domain/category';
import { DeleteMovementButton } from './delete-movement-button';
import { formatAmount, formatDate } from '../../../lib/format';
import { deriveSystemNote } from '../../../lib/system-note';
import { syntheticCategoryLabel } from '../../../lib/synthetic-category-label';
import { Select } from '../../../components/ui/select';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';
import { BackButton } from '../../../components/ui/back-button';
import { ArrowLeftRight, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useQuickMovement } from '../global-movement-provider';
import { EditMovementModal } from './edit-movement-modal';
import { listAccountsAction, listCategoriesAction, listMovementsPagedAction } from './actions';
import type { SerializedCursor } from './actions';

type SortField = 'date' | 'amount' | 'category';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 50;

export function MovementsList({
  initialMovements,
  nextCursor: initialCursor,
  refLabels = {},
}: {
  initialMovements: SerializedMovement[];
  nextCursor: SerializedCursor | null;
  /** Parent counterparty labels (credit/sale/payable id → name) for note derivation. */
  refLabels?: Record<string, string>;
}) {
  const [movements, setMovements] = useState<SerializedMovement[]>(initialMovements);
  const [nextCursor, setNextCursor] = useState<SerializedCursor | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  // R5-B: re-sync the table whenever the server pushes fresh first-page props
  // (after router.refresh() following a create/update/delete). The list used
  // to hold a useState snapshot that never updated, so rows created/edited/
  // removed elsewhere stayed visible until a full reload.
  // The server reconstructs initialMovements/initialCursor on every render, so
  // re-syncing must compare the first page by CONTENT, not by reference, or the
  // rows accumulated via "Cargar más" get silently reset to page 1.
  const firstPageRef = useRef<SerializedMovement[]>(initialMovements);
  useEffect(() => {
    const incoming = JSON.stringify(initialMovements);
    if (incoming === JSON.stringify(firstPageRef.current)) {
      // Fresh props but the first page is identical → keep the pagination the
      // user already accumulated via "Cargar más". Only a real data change
      // (row created/edited/deleted) should reset the accumulated list.
      return;
    }
    firstPageRef.current = initialMovements;
    setMovements(initialMovements);
    setNextCursor(initialCursor);
  }, [initialMovements, initialCursor]);

  // Reference data loaded lazily for the form / filters
  const [accounts, setAccounts] = useState<SerializedAccount[]>([]);
  const [categories, setCategories] = useState<SerializedCategory[]>([]);

  useEffect(() => {
    listAccountsAction().then(setAccounts);
    listCategoriesAction().then(setCategories);
  }, []);

  const [selectedAccountId, setSelectedAccountId] = useState('all');
  /** D3 scope filter — only meaningful while 'all accounts' is active. */
  const [selectedScope, setSelectedScope] = useState<'all' | 'Personal' | 'Business'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [editingMovement, setEditingMovement] = useState<SerializedMovement | null>(null);
  const t = useT('Movements');
  const tCommon = useT('Common');
  const tSystemNotes = useT('SystemNotes');
  const locale = useLocale();
  const { openQuickMovement } = useQuickMovement();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'date' ? 'desc' : 'desc');
      return field;
    });
  }, []);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <Icon icon={ChevronUp} size="sm" className="ml-0.5 inline" />
      : <Icon icon={ChevronDown} size="sm" className="ml-0.5 inline" />;
  };

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listMovementsPagedAction(PAGE_SIZE, nextCursor);
      setMovements((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  // D3: scope filter uses Movement.context (the source of truth).
  const allMovements = useMemo(() => {
    if (selectedAccountId === 'all') {
      return selectedScope === 'all'
        ? movements
        : movements.filter((m) => m.context === selectedScope);
    }
    return movements.filter((m) => m.accountId === selectedAccountId);
  }, [movements, selectedAccountId, selectedScope]);

  const filteredMovements = useMemo(() => {
    if (selectedType === 'all') return allMovements;
    return allMovements.filter((m) => m.type === selectedType);
  }, [allMovements, selectedType]);

  const sortedMovements = useMemo(() => {
    const arr = [...filteredMovements];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          cmp = a.amount.amount - b.amount.amount;
          break;
        case 'category': {
          const labelA = categoryMap.get(a.categoryId) ?? syntheticCategoryLabel(a.categoryId, tSystemNotes) ?? '';
          const labelB = categoryMap.get(b.categoryId) ?? syntheticCategoryLabel(b.categoryId, tSystemNotes) ?? '';
          cmp = labelA.localeCompare(labelB, locale);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredMovements, sortField, sortDir, categoryMap, tSystemNotes, locale]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        {selectedAccountId && (
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openQuickMovement(
                selectedAccountId === 'all'
                  ? undefined
                  : { accountId: selectedAccountId },
              )
            }
          >
            {t('addMovement')}
          </Button>
        )}
      </div>

      {/* Account selector + scope filter + type filter */}
      {accounts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div>
            <label
              htmlFor="type-select"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('type')}
            </label>
            <Select
              id="type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
              options={[
                { value: 'all', label: t('scopeAll') },
                { value: 'income', label: t('income') },
                { value: 'expense', label: t('expense') },
              ]}
            />
          </div>
        </div>
      )}

      {accounts.length === 0 && movements.length === 0 ? (
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
            <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-card dark:border-zinc-700 dark:bg-zinc-900">
              <table className="w-full min-w-[700px] divide-y divide-zinc-200 dark:divide-zinc-700">
                <thead className="bg-surface-header dark:bg-zinc-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center hover:text-zinc-900 dark:hover:text-white transition-colors">
                        {tCommon('date')} <SortIcon field="date" />
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center hover:text-zinc-900 dark:hover:text-white transition-colors">
                        {tCommon('amount')} <SortIcon field="amount" />
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <button type="button" onClick={() => toggleSort('category')} className="inline-flex items-center hover:text-zinc-900 dark:hover:text-white transition-colors">
                        {t('category')} <SortIcon field="category" />
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {tCommon('note')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {t('type')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {categoryMap.get(movement.categoryId) ?? syntheticCategoryLabel(movement.categoryId, tSystemNotes) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                        {movement.link
                          ? (deriveSystemNote(movement, tSystemNotes, refLabels) ?? movement.note) || '—'
                          : (movement.note || '—')}
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!movement.link && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingMovement(movement)}
                                className="rounded p-1 text-zinc-400 hover:text-primary transition-colors"
                                aria-label={tCommon('edit')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                              </button>
                              <DeleteMovementButton movementId={movement.id} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Load more */}
              {nextCursor && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-2">
                        <Icon icon={Loader2} size="sm" className="animate-spin" />
                        {tCommon('loading')}
                      </span>
                    ) : (
                      tCommon('loadMore')
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editingMovement && (
        <EditMovementModal
          movement={editingMovement}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditingMovement(null)}
        />
      )}
    </div>
  );
}
