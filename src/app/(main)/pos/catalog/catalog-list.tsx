'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import type { CatalogItem } from '../../../../core/domain/catalog';
import { CatalogForm } from './catalog-form';
import { deleteCatalogItemAction } from './actions';
import { formatAmount } from '../../../../lib/format';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Icon } from '../../../../components/ui/icon';
import { Package } from 'lucide-react';

export function CatalogList({ items }: { items: CatalogItem[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const t = useT('Catalog');
  const tCommon = useT('Common');
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingItem(null);
          }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {showForm ? tCommon('cancel') : t('addItem')}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {t('newItem')}
          </h2>
          <CatalogForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {editingItem && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {t('editItem')}
          </h2>
          <CatalogForm item={editingItem} onDone={() => setEditingItem(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Package} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const currency = item.unitPrice.currency;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex-1">
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {item.name}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {t(`type_${item.type}`)}
                    </span>
                    {item.type === 'product' && item.stock !== undefined && (
                      <span className="ml-2">
                        {t('stock')}: {item.stock}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {formatAmount(item.unitPrice.amount, currency, locale)} {currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setShowForm(false);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {t('edit')}
                    </button>
                    <form
                      action={deleteCatalogItemAction}
                      onSubmit={(e) => {
                        if (!confirm(t('confirmDelete'))) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {tCommon('delete')}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
