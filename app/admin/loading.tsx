import { CardSkeleton, LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );
}
