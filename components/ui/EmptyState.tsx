import { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center sm:py-12',
        className
      )}
    >
      <div
        className={cn(
          'mb-4 flex size-12 items-center justify-center rounded-2xl',
          tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-primary'
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-ink-muted">{description}</p>}
      {(action || (actionHref && actionLabel)) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actionHref && actionLabel && <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>}
          {action}
        </div>
      )}
    </div>
  );
}
