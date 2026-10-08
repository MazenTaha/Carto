import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  suffix?: string;
  helper?: string;
  tone?: 'neutral' | 'success' | 'danger';
  className?: string;
}

const iconTones = {
  neutral: 'bg-brand-50 text-primary',
  success: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-red-50 text-red-600',
};

export function StatsCard({ title, value, icon: Icon, trend, suffix, helper, tone = 'neutral', className }: StatsCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div className={cn('surface-card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{title}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', iconTones[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-1">
        <span className="tabular font-display text-2xl font-semibold tracking-tight text-ink">{value}</span>
        {suffix && <span className="text-sm text-ink-subtle">{suffix}</span>}
      </p>

      {helper && <p className="mt-0.5 text-xs text-ink-subtle">{helper}</p>}

      {trend && (
        <p className="mt-1 flex items-center gap-1 text-xs">
          {isPositive ? (
            <TrendingUp className="size-3 text-emerald-600" aria-hidden="true" />
          ) : (
            <TrendingDown className="size-3 text-red-600" aria-hidden="true" />
          )}
          <span className={cn('font-medium', isPositive ? 'text-emerald-700' : 'text-red-700')}>
            {isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-ink-subtle">{trend.label}</span>
        </p>
      )}
    </div>
  );
}
