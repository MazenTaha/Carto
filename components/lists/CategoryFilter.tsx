'use client';

import { ProductCategorySummary } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: ProductCategorySummary[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div role="group" aria-label="Category" className="no-scrollbar -mx-1 overflow-x-auto px-1 py-0.5">
      <div className="flex min-w-max gap-1.5">
        {categories.map((category) => {
          const isActive = selectedCategory === category.name;

          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onSelect(category.name)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                isActive ? 'bg-brand-100 text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              )}
            >
              {category.name}
              {category.count > 0 && (
                <span className={cn('tabular text-2xs', isActive ? 'text-primary/80' : 'text-ink-subtle')}>{category.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
