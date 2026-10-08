import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  className?: string;
  /** `rows` renders label/value pairs side-by-side; `grid` renders compact tiles. */
  layout?: 'rows' | 'grid';
}

export function DescriptionList({ items, className, layout = 'rows' }: DescriptionListProps) {
  if (layout === 'grid') {
    return (
      <dl className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
        {items.map((item, index) => (
          <div key={index} className="min-w-0 rounded-xl bg-surface-muted px-3.5 py-3">
            <dt className="text-xs font-medium text-ink-subtle">{item.label}</dt>
            <dd className={cn('mt-1 truncate text-sm font-semibold text-ink', item.mono && 'font-mono')}>{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
          <dt className="shrink-0 text-ink-muted">{item.label}</dt>
          <dd className={cn('min-w-0 truncate text-right font-semibold text-ink', item.mono && 'font-mono')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
