import { Skeleton } from '../../../components/ui/skeleton';

export default function MovementsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
