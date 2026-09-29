import { Skeleton } from "../../../../../components/ui/skeleton";

/**
 * Mirrors ReceiptHistoryList: header + section nav + activist filter card
 * (search / date range / actions), then MovementCard receipts at max-w-3xl
 * — supplier (primary), date, total, payment badge, flat line rows.
 */
export default function ReceiptHistoryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Section nav */}
      <div className="mb-6 flex gap-4 border-b border-surface-border pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Filter card */}
      <div className="mb-5 grid gap-3 rounded-xl border border-surface-border bg-surface-card p-4 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Results count + MovementCards */}
      <Skeleton className="mb-3 h-4 w-12" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex justify-between gap-2 py-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
