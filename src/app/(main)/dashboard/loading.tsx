import { Skeleton } from '../../../components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-surface-border bg-surface-card p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-lg border border-surface-border bg-surface-card p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-full w-full" />
        </div>
        <div className="h-80 rounded-lg border border-surface-border bg-surface-card p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div>
        <Skeleton className="mb-4 h-7 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-surface-border bg-surface-card p-6 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Skeleton className="mb-3 h-5 w-24" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-6 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
