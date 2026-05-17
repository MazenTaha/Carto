import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
  suffix?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBg = 'bg-indigo-50',
  trend,
  suffix,
  className,
}: StatsCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconBg)}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>

      <div className="mt-3 flex items-end gap-1">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {suffix && <span className="mb-0.5 text-sm font-medium text-slate-500">{suffix}</span>}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp size={12} className="text-emerald-500" />
          ) : (
            <TrendingDown size={12} className="text-red-400" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-emerald-600' : 'text-red-500'
            )}
          >
            {isPositive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-slate-400">{trend.label}</span>
        </div>
      )}

      {/* Subtle gradient accent */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-indigo-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
