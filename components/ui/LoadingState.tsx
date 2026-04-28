import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex min-h-[280px] flex-col items-center justify-center gap-4 text-center', className)}>
      <div className="size-12 rounded-full border-4 border-primary/15 border-t-primary animate-spin" />
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    </div>
  );
}
