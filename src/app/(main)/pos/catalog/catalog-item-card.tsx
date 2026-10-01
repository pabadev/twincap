"use client";

import type { ReactNode } from "react";
import type { CatalogItemType } from "../../../../core/domain/catalog";
import { catalogTypeBadgeClasses } from "./catalog-type-style";

export function CatalogItemCard({
  id,
  highlighted = false,
  name,
  type,
  typeLabel,
  priceLabel,
  price,
  priceUnit,
  stockLabel,
  stock,
  stockUnit,
  notApplicable,
  actions,
}: {
  id?: string;
  highlighted?: boolean;
  name: string;
  type: CatalogItemType;
  typeLabel: string;
  priceLabel: string;
  price: string;
  priceUnit: string;
  stockLabel: string;
  stock: string | null;
  stockUnit: string;
  notApplicable: string;
  actions: ReactNode;
}) {
  return (
    <article
      id={id ? `catalog-item-${id}` : undefined}
      className={`flex min-h-40 flex-col rounded-lg border bg-surface-card px-4 py-3 transition-shadow dark:bg-zinc-900 ${
        highlighted
          ? "border-primary ring-2 ring-primary/30"
          : "border-surface-border dark:border-zinc-700"
      }`}
    >
      <header className="flex min-h-11 items-start justify-between gap-3">
        <h2 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-white">
          {name}
        </h2>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${catalogTypeBadgeClasses(type)}`}
        >
          {typeLabel}
        </span>
      </header>

      <dl data-card-details className="h-[4.75rem] space-y-2 overflow-hidden pt-1">
        <div data-card-detail="price" className="flex items-start justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {priceLabel}
          </dt>
          <dd className="min-w-0 max-w-[72%] text-right">
            <div
              className="truncate text-sm font-medium text-zinc-900 dark:text-white"
              title={price}
            >
              {price}
            </div>
            {priceUnit ? (
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={priceUnit}>
                {priceUnit}
              </div>
            ) : null}
          </dd>
        </div>
        <div data-card-detail="stock" className="flex items-start justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {stockLabel}
          </dt>
          <dd
            className={`min-w-0 max-w-[72%] truncate whitespace-nowrap text-right text-sm font-medium ${stock === null ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-white"}`}
            title={stock === null ? notApplicable : `${stock} ${stockUnit}`}
          >
            {stock === null ? notApplicable : `${stock} ${stockUnit}`}
          </dd>
        </div>
      </dl>

      <footer className="mt-auto flex min-h-11 flex-wrap items-center justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        {actions}
      </footer>
    </article>
  );
}
