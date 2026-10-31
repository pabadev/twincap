"use client";

import { useT } from "../../i18n/client";
import { Select } from "../ui/select";
import { Tabs } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { X } from "lucide-react";
// R14-K §14c: the filter types live in core; re-exported here so the
// presentation layer keeps its stable import path.
import type {
  DashboardFilters,
  ScopeFilter,
  DashboardPeriod,
} from "../../core/application/dashboard/dashboard-types";
export type {
  DashboardFilters,
  ScopeFilter,
  DashboardPeriod,
} from "../../core/application/dashboard/dashboard-types";

interface FilterOption {
  value: string;
  label: string;
}

interface DashboardFilterPartsProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

/**
 * Scope tabs — ALWAYS VISIBLE (fundador, 2026-10-31): the scope is the
 * primary context of the whole Resumen, in the same language as Movements
 * (shared Tabs kit). URL persistence lives in dashboard-content
 * (Traveling-filter contract), unchanged.
 */
export function DashboardScopeTabs({ filters, onFiltersChange }: DashboardFilterPartsProps) {
  const t = useT("Dashboard");

  return (
    <Tabs
      ariaLabel={t("filterScope")}
      variant="tab"
      value={filters.scope}
      onChange={(id) => onFiltersChange({ ...filters, scope: id as ScopeFilter })}
      items={[
        { id: "all", label: t("filterScopeAll") },
        { id: "Personal", label: t("filterScopePersonal") },
        { id: "Business", label: t("filterScopeBusiness") },
      ]}
    />
  );
}

/**
 * Secondary filters (period/account/category + active-filter chips) —
 * progressive disclosure behind the Filtros toggle in dashboard-content.
 * The scope chip is intentionally ABSENT from the row: the always-visible
 * tabs above already communicate and clear the scope (quieter by audit).
 */
export function DashboardSecondaryFilters({
  filters,
  onFiltersChange,
  accounts,
  categories,
}: DashboardFilterPartsProps & {
  accounts: FilterOption[];
  categories: FilterOption[];
}) {
  const t = useT("Dashboard");

  const hasSecondaryFilters =
    filters.accountId !== "all" ||
    filters.categoryId !== "all" ||
    (filters.period ?? "month") !== "month";

  function updateFilter<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onFiltersChange({
      scope: "all",
      accountId: "all",
      categoryId: "all",
      period: "month",
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label={t("periodLabel")}
          value={filters.period ?? "month"}
          onChange={(e) => updateFilter("period", e.target.value as DashboardPeriod)}
          options={[
            { value: "month", label: t("periodMonth") },
            { value: "year", label: t("periodYear") },
          ]}
        />
        <Select
          label={t("filterAccount")}
          value={filters.accountId}
          onChange={(e) => updateFilter("accountId", e.target.value)}
          options={[{ value: "all", label: t("filterAccountAll") }, ...accounts]}
        />
        <Select
          label={t("filterCategory")}
          value={filters.categoryId}
          onChange={(e) => updateFilter("categoryId", e.target.value)}
          options={[{ value: "all", label: t("filterCategoryAll") }, ...categories]}
        />
      </div>
      {hasSecondaryFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{t("periodLabel")}:</span>
          {filters.period === "year" && (
            <Badge variant="info">
              {t("periodYear")}
              <button
                onClick={() => updateFilter("period", "month")}
                className="ml-1 inline-flex items-center"
                aria-label={t("removeFilter")}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.accountId !== "all" && (
            <Badge variant="info">
              {accounts.find((a) => a.value === filters.accountId)?.label}
              <button
                onClick={() => updateFilter("accountId", "all")}
                className="ml-1 inline-flex items-center"
                aria-label={t("removeFilter")}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {filters.categoryId !== "all" && (
            <Badge variant="info">
              {categories.find((c) => c.value === filters.categoryId)?.label}
              <button
                onClick={() => updateFilter("categoryId", "all")}
                className="ml-1 inline-flex items-center"
                aria-label={t("removeFilter")}
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          <button
            onClick={clearAll}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {t("filterClearAll")}
          </button>
        </div>
      )}
    </div>
  );
}
