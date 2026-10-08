import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}

export function EmptyState({ icon, title, description, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div
          className={cn(
            'mb-4 flex size-12 items-center justify-center rounded-2xl [&_svg]:size-6',
            tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-surface-muted text-ink-subtle'
          )}
        >
          {icon}
        </div>
      )}
      <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
