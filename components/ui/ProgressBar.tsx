import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  tone?: 'brand' | 'success' | 'inverse';
}

const fills = {
  brand: 'bg-primary',
  success: 'bg-emerald-500',
  inverse: 'bg-white',
};

const tracks = {
  brand: 'bg-brand-100',
  success: 'bg-emerald-100',
  inverse: 'bg-white/20',
};

export function ProgressBar({ value, className, label, showValue = true, size = 'md', tone = 'brand' }: ProgressBarProps) {
  const safeValue = Math.round(Math.max(0, Math.min(100, value)));

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
          <span>{label}</span>
          {showValue && <span className="tabular">{safeValue}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('overflow-hidden rounded-full', tracks[tone], size === 'sm' ? 'h-1.5' : 'h-2')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fills[tone])}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
