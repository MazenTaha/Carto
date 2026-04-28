import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'emerald' | 'slate' | 'amber';
  className?: string;
}

export function MetricCard({ icon, label, value, helper, tone = 'emerald', className }: MetricCardProps) {
  const tones = {
    emerald: 'bg-primary/10 text-primary',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  };

  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">{value}</div>
        </div>
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', tones[tone])}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      {helper && <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">{helper}</div>}
    </div>
  );
}
