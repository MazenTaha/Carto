import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'brand' | 'slate' | 'amber';
  className?: string;
}

export function MetricCard({ icon, label, value, helper, tone = 'brand', className }: MetricCardProps) {
  const tones = {
    brand: 'bg-primary/10 text-primary',
    slate: 'bg-primary-soft text-warm-muted dark:bg-primary-soft dark:text-warm-muted',
    amber: 'bg-surface-muted/70 text-primary-dark dark:bg-surface-muted/70 dark:text-primary-dark',
  };

  return (
    <div className={cn('rounded-2xl border border-warm-border/45 bg-white p-4 shadow-card dark:border-warm-border/45 dark:bg-white sm:p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-950">{value}</div>
        </div>
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', tones[tone])}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      {helper && <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-500">{helper}</div>}
    </div>
  );
}
