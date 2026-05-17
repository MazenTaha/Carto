export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-4">
          <div className="h-8 w-8 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-2 w-1/2 rounded bg-slate-200" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-9 w-9 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
      <div className="mt-2 h-2 w-20 rounded bg-slate-100" />
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl border border-slate-100 bg-white p-6"
      style={{ height }}
    >
      <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
      <div className="h-full w-full rounded-xl bg-slate-100" />
    </div>
  );
}
