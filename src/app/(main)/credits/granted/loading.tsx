import { Skeleton } from '../../../../components/ui/skeleton';

export default function CreditsGrantedLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
