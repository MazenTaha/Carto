'use client';

import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface ChipTabsProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** Horizontally scrollable filter chips. Behaves as a single-select toggle group. */
export function ChipTabs<T extends string>({ options, value, onChange, ariaLabel, className, size = 'md' }: ChipTabsProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('no-scrollbar -mx-1 overflow-x-auto px-1 py-0.5', className)}>
      <div className="flex min-w-max gap-2">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
                size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm',
                isActive
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle/50 hover:text-ink'
              )}
            >
              {option.label}
              {typeof option.count === 'number' && (
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 text-2xs font-semibold',
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-muted text-ink-subtle'
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
