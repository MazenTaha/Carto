import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted' | 'connected';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-primary/10 text-primary ring-primary/15',
    success: 'bg-primary/10 text-primary ring-primary/20 dark:bg-primary/10 dark:text-primary dark:ring-primary/20',
    warning: 'bg-surface-muted/65 text-slate-900 ring-warm-border/45 dark:bg-surface-muted/65 dark:text-slate-900 dark:ring-warm-border/45',
    danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-50 dark:text-red-700 dark:ring-red-200',
    muted: 'bg-primary-soft text-warm-muted ring-warm-border/35 dark:bg-primary-soft dark:text-warm-muted dark:ring-warm-border/35',
    connected: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1', variants[variant], className)}>
      {children}
    </span>
  );
}
