import Link from 'next/link';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = 'inventory_2', title, description, actionLabel, actionHref, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-3xl border border-dashed border-warm-border/55 bg-white p-8 text-center shadow-sm dark:border-warm-border/55 dark:bg-white', className)}>
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <h2 className="text-lg font-bold text-slate-950 dark:text-slate-950">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-500">{description}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-glow transition active:scale-95">
          {actionLabel}
        </Link>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
