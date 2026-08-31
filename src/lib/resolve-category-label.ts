import type { SerializedCategory } from '../core/domain/category';
import { isSyntheticCategoryId } from '../core/domain/synthetic-categories';
import { syntheticCategoryLabel } from './synthetic-category-label';

/**
 * Build a category-label resolver for the dashboard snapshot builder.
 *
 * Mirrors the resolution order used by `dashboard-content.tsx`: real
 * (persisted) categories first, then the localized synthetic label for
 * system categories, then the "uncategorized" fallback. Extracted so the
 * server-side snapshot builder (page load + server action) resolves labels
 * exactly as the client previously did. Pure — no I/O.
 */
export function makeCategoryLabelResolver(opts: {
  categories: SerializedCategory[];
  tSystemNotes: (key: string, params?: Record<string, string>) => string;
  tDashboard: (key: string, params?: Record<string, string>) => string;
}): (categoryId: string) => string {
  const realMap = new Map(
    opts.categories
      .filter((c) => !isSyntheticCategoryId(c.id))
      .map((c) => [c.id, c.name] as const),
  );

  return (categoryId: string): string => {
    return (
      realMap.get(categoryId) ??
      syntheticCategoryLabel(categoryId, opts.tSystemNotes) ??
      opts.tDashboard('uncategorized')
    );
  };
}
