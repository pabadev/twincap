'use client';

import { useT } from '../../i18n/client';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { X } from 'lucide-react';

export type ScopeFilter = 'all' | 'Personal' | 'Business';
export type PeriodFilter = 'current_month' | 'previous_month' | 'this_year';

export interface DashboardFilters {
  scope: ScopeFilter;
  accountId: string;
  categoryId: string;
  period: PeriodFilter;
  /**
   * Optional inclusive date range (ISO 'YYYY-MM-DD', JSON-safe across the
   * server→client boundary). When either bound is set, it REPLACES the period
   * filter (A3, Fase 3 pre-beta audit): the period Select is disabled in the
   * UI and `buildDashboardSnapshot` skips the period branch entirely.
   */
  dateFrom?: string;
  dateTo?: string;
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

  const hasDateRangeActive = Boolean(filters.dateFrom) || Boolean(filters.dateTo);

  const hasActiveFilters =
    filters.scope !== 'all' ||
    filters.accountId !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.period !== 'current_month' ||
    hasDateRangeActive;

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
      period: 'current_month',
      dateFrom: undefined,
      dateTo: undefined,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
        <Select
          label={t('filterPeriod')}
          value={filters.period}
          onChange={(e) => updateFilter('period', e.target.value as PeriodFilter)}
          disabled={hasDateRangeActive}
          options={[
            { value: 'current_month', label: t('filterPeriodCurrentMonth') },
            { value: 'previous_month', label: t('filterPeriodPreviousMonth') },
            { value: 'this_year', label: t('filterPeriodThisYear') },
          ]}
        />
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {t('filterDateFrom')}
          </label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {t('filterDateTo')}
          </label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="h-10 w-full rounded-md border border-surface-border bg-surface-input px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-input dark:text-white"
          />
        </div>
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
          {filters.period !== 'current_month' && (
            <Badge variant="info">
              {filters.period === 'previous_month'
                ? t('filterPeriodPreviousMonth')
                : t('filterPeriodThisYear')}
              <button
                onClick={() => updateFilter('period', 'current_month')}
                className="ml-1 inline-flex items-center"
                aria-label={t('removeFilter')}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="info">
              {t('filterDateFrom')}: {filters.dateFrom}
              <button
                onClick={() => updateFilter('dateFrom', undefined)}
                className="ml-1 inline-flex items-center"
                aria-label={t('removeFilter')}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="info">
              {t('filterDateTo')}: {filters.dateTo}
              <button
                onClick={() => updateFilter('dateTo', undefined)}
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
            {t('filterCategoryAll')}
          </button>
        </div>
      )}
    </div>
  );
}
