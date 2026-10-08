import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
}

export function MetricCard({ icon: Icon, label, value, helper, className }: MetricCardProps) {
  return (
    <div className={cn('surface-card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="tabular mt-2 font-display text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {helper && <div className="mt-1 text-sm text-ink-subtle">{helper}</div>}
    </div>
  );
}
