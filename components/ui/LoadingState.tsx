import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-primary', className)}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[240px] flex-col items-center justify-center gap-3 text-center', className)}
    >
      <Spinner className="size-7" />
      <p className="text-sm font-medium text-ink-muted">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-sunken', className)} aria-hidden="true" />;
}
