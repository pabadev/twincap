'use client';

import { useState, useEffect, useMemo } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import type { SerializedCatalogItem } from '../../../../core/domain/catalog';
import { CatalogForm } from './catalog-form';
import { DeleteCatalogItemButton } from './delete-catalog-item-button';
import { formatAmount } from '../../../../lib/format';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Icon } from '../../../../components/ui/icon';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { BackButton } from '../../../../components/ui/back-button';
import { ActionIconButton } from '../../../../components/ui/action-icon-button';
import { Package, Pencil, Search } from 'lucide-react';

export function CatalogList({ items }: { items: SerializedCatalogItem[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SerializedCatalogItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const t = useT('Catalog');
  const locale = useLocale();

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter items by name (case-insensitive)
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return items;
    const query = debouncedQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedQuery]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          {t('addItem')}
        </Button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newItem')}
      >
        <CatalogForm onDone={() => setShowForm(false)} />
      </Modal>

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={t('editItem')}
      >
        {editingItem && (
          <CatalogForm item={editingItem} onDone={() => setEditingItem(null)} />
        )}
      </Modal>

      {/* Search input */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon icon={Search} size="sm" className="text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-surface-border bg-surface-input py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-card dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {debouncedQuery.trim()
              ? filteredItems.length > 0
                ? t('results', { count: String(filteredItems.length), total: String(items.length) })
                : t('noResults')
              : t('results', { count: String(items.length), total: String(items.length) })}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Package} size="xl" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Search} size="xl" />}
          title={t('noResults')}
          description={t('search')}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const currency = item.unitPrice.currency;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-card px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
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
                      {formatAmount(item.unitPrice.amount, currency, locale)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionIconButton
                      icon={Pencil}
                      label={t('edit')}
                      tone="primary"
                      onClick={() => setEditingItem(item)}
                    />
                    <DeleteCatalogItemButton itemId={item.id} />
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
