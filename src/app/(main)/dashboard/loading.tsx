import { Skeleton } from "../../../components/ui/skeleton";
import { ContentContainer } from "../../../components/ui/content-container";

export default function DashboardLoading() {
  return (
    <ContentContainer>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>

        {/* N1 HERO — two panes: result + available */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 sm:p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-9 w-56" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 sm:p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Skeleton className="h-3 w-36" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>

        {/* N2 DESGLOSE — summary cards (4-card grid) */}
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

        {/* N3 EVOLUCIÓN — chart */}
        <div className="h-80 rounded-lg border border-surface-border bg-surface-card p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-full w-full" />
        </div>

        {/* N4 ATENCIÓN — row of cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-surface-border bg-surface-card p-4 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Skeleton className="h-3 w-24" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* N5 DETALLE — recent movements + accounts/position */}
        <div className="rounded-lg border border-surface-border bg-surface-card p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
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
    </ContentContainer>
  );
}
