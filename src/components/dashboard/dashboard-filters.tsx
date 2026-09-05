'use client';

import { useT } from '../../i18n/client';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { X } from 'lucide-react';

export type ScopeFilter = 'all' | 'Personal' | 'Business';

export interface DashboardFilters {
  scope: ScopeFilter;
  accountId: string;
  categoryId: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  accounts: FilterOption[];
  categories: FilterOption[];
}

export function DashboardFilterBar({
  filters,
  onFiltersChange,
  accounts,
  categories,
}: DashboardFilterBarProps) {
  const t = useT('Dashboard');

  const hasActiveFilters =
    filters.scope !== 'all' ||
    filters.accountId !== 'all' ||
    filters.categoryId !== 'all';

  function updateFilter<K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onFiltersChange({
      scope: 'all',
      accountId: 'all',
      categoryId: 'all',
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label={t('filterScope')}
          value={filters.scope}
          onChange={(e) => updateFilter('scope', e.target.value as ScopeFilter)}
          options={[
            { value: 'all', label: t('filterScopeAll') },
            { value: 'Personal', label: t('filterScopePersonal') },
            { value: 'Business', label: t('filterScopeBusiness') },
          ]}
        />
        <Select
          label={t('filterAccount')}
          value={filters.accountId}
          onChange={(e) => updateFilter('accountId', e.target.value)}
          options={[
            { value: 'all', label: t('filterAccountAll') },
            ...accounts,
          ]}
        />
        <Select
          label={t('filterCategory')}
          value={filters.categoryId}
          onChange={(e) => updateFilter('categoryId', e.target.value)}
          options={[
            { value: 'all', label: t('filterCategoryAll') },
            ...categories,
          ]}
        />
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t('filterScope')}:
          </span>
          {filters.scope !== 'all' && (
            <Badge variant="info">
              {filters.scope === 'Personal'
                ? t('filterScopePersonal')
                : t('filterScopeBusiness')}
              <button
                onClick={() => updateFilter('scope', 'all')}
                className="ml-1 inline-flex items-center"
                aria-label={t('removeFilter')}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.accountId !== 'all' && (
            <Badge variant="info">
              {accounts.find((a) => a.value === filters.accountId)?.label}
              <button
                onClick={() => updateFilter('accountId', 'all')}
                className="ml-1 inline-flex items-center"
                aria-label={t('removeFilter')}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.categoryId !== 'all' && (
            <Badge variant="info">
              {categories.find((c) => c.value === filters.categoryId)?.label}
              <button
                onClick={() => updateFilter('categoryId', 'all')}
                className="ml-1 inline-flex items-center"
                aria-label={t('removeFilter')}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          <button
            onClick={clearAll}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {t('filterClearAll')}
          </button>
        </div>
      )}
    </div>
  );
}