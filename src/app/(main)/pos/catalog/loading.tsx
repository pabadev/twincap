import { Skeleton } from "../../../../components/ui/skeleton";

/**
 * Mirrors CatalogList: header + section nav + search, then the grouped
 * display — "a la venta" grid first, then services, then the collapsed
 * supplies bar (owner priority rule).
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Section nav */}
      <div className="mb-6 flex gap-4 border-b border-surface-border pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Search */}
      <div className="mb-4">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="mt-1 h-3 w-36" />
      </div>

      {/* Group 1: for sale (3-col card grid on desktop) */}
      <section className="mb-8">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex min-h-11 items-start justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="h-[4.75rem] space-y-2 pt-1">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-3 w-10" />
                  <div className="space-y-1 text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                    <Skeleton className="ml-auto h-3 w-16" />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="mt-auto flex items-center justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Supplies: collapsed details bar with count */}
      <details open className="rounded-lg border border-surface-border dark:border-zinc-700">
        <summary className="px-4 py-3">
          <Skeleton className="inline-block h-4 w-20" />
          <Skeleton className="ml-2 inline-block h-5 w-8 rounded-full" />
        </summary>
        <div className="grid grid-cols-1 items-stretch gap-3 px-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </details>
    </div>
  );
}
