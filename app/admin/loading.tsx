import { CardSkeleton, LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { Skeleton } from '@/components/ui/LoadingState';

export default function AdminLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="surface-card overflow-hidden">
        <LoadingSkeleton rows={6} />
      </div>
    </div>
  );
}
