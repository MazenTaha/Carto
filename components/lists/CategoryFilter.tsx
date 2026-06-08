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
    <div className="overflow-x-auto pb-1 no-scrollbar">
      <div className="flex min-w-max gap-2">
        {categories.map((category) => {
          const isActive = selectedCategory === category.name;

          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onSelect(category.name)}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950',
                isActive
                  ? 'border-primary bg-primary text-white shadow-glow'
                  : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-primary/30 hover:bg-white hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <span>{category.name}</span>
              {category.count > 0 && (
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-[11px] font-black',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {category.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
