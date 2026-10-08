import { Skeleton } from '@/components/ui/LoadingState';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="surface-card p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-20" />
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="surface-card p-5" style={{ height }} aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-[calc(100%-2rem)] w-full rounded-xl" />
    </div>
  );
}
