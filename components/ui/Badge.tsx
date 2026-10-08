import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'inverse';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Shows a leading status dot; `pulse` animates it for live states. */
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted ring-line',
  brand: 'bg-brand-50 text-primary ring-brand-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  inverse: 'bg-white/10 text-white ring-white/20',
};

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-ink-subtle',
  brand: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  inverse: 'bg-white',
};

export function Badge({ children, tone = 'neutral', dot = false, pulse = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className
      )}
    >
      {(dot || pulse) && (
        <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
          {pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', dots[tone])} />}
          <span className={cn('relative size-1.5 rounded-full', dots[tone])} />
        </span>
      )}
      {typeof children === 'string' ? (
        <span className="truncate">{children}</span>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1 [&>svg]:shrink-0">{children}</span>
      )}
    </span>
  );
}
