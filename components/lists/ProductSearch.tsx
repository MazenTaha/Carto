'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/lib/hooks';
import { Loader2, Package, Plus, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChipTabs } from '@/components/ui/ChipTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { inputClassName } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/LoadingState';
import { CategoryFilter } from '@/components/lists/CategoryFilter';
import { cn } from '@/lib/utils';
import { ProductCategorySummary, ProductFinderTab, ProductSearchResult } from '@/types';
import { PRODUCT_CATEGORY_FALLBACKS } from '@/lib/product-finder';
import { DEFAULT_BASE_PRICE_EGP } from '@/lib/pricing';

const ALL_CATEGORY_NAME = 'All';

const TAB_OPTIONS: Array<{ label: string; value: ProductFinderTab }> = [
  { label: 'Popular', value: 'popular' },
  { label: 'Recent', value: 'recent' },
  { label: 'Favorites', value: 'favorites' },
];

interface ProductSearchProps {
  onSelect: (product: ProductSearchResult) => void | Promise<void>;
  /** Kept for API compatibility; the surrounding modal owns dismissal. */
  onCancel?: () => void;
}

function buildFallbackCategories(): ProductCategorySummary[] {
  return PRODUCT_CATEGORY_FALLBACKS.map((name) => ({
    name,
    count: 0,
  }));
}

function readProductsResponse(payload: any): ProductSearchResult[] {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function readCategoryResponse(payload: any): ProductCategorySummary[] {
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function ProductSearch({ onSelect }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [categories, setCategories] = useState<ProductCategorySummary[]>(buildFallbackCategories());
  const [isLoading, setIsLoading] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProductFinderTab>('popular');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_NAME);
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsCategoryLoading(true);

    async function fetchCategories() {
      try {
        const res = await fetch('/api/products/categories', {
          signal: controller.signal,
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        const nextCategories = readCategoryResponse(data);

        if (nextCategories.length > 0) {
          setCategories(nextCategories);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch product categories', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsCategoryLoading(false);
        }
      }
    }

    void fetchCategories();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const search = debouncedQuery.trim();
    const category = selectedCategory === ALL_CATEGORY_NAME ? '' : selectedCategory;
    setIsLoading(true);

    async function fetchProducts() {
      try {
        const params = new URLSearchParams({
          query: search,
          limit: '20',
          tab: activeTab,
        });

        if (category) {
          params.set('category', category);
        }

        const res = await fetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        setResults(readProductsResponse(data));
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch products', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchProducts();
    return () => controller.abort();
  }, [activeTab, debouncedQuery, selectedCategory]);

  const categoryOptions = useMemo(() => {
    const totalCount = categories.reduce((sum, category) => sum + category.count, 0);
    return [{ name: ALL_CATEGORY_NAME, count: totalCount }, ...categories];
  }, [categories]);

  const handleSelectProduct = async (product: ProductSearchResult) => {
    if (selectingProductId) return;
    setSelectingProductId(product.id);
    try {
      await onSelect(product);
    } finally {
      setSelectingProductId(null);
    }
  };

  const emptyStateTitle =
    selectedCategory !== ALL_CATEGORY_NAME
      ? 'No products found in this category.'
      : activeTab === 'favorites'
        ? 'No favorite products found.'
        : 'No matching products found.';

  const emptyStateDescription =
    activeTab === 'favorites'
      ? 'Favorites update from your saved purchase history and product likes.'
      : 'Try another search term or switch categories.';

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b border-line px-5 pb-4 pt-2 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            ref={inputRef}
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="Search milk, apples, coffee…"
            className={cn(inputClassName, 'pl-11 pr-11')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {(isLoading || isCategoryLoading) && (
            <Loader2 className="absolute right-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 animate-spin text-primary" aria-label="Loading" />
          )}
        </div>

        <ChipTabs
          ariaLabel="Product list"
          size="sm"
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
        />

        <CategoryFilter
          categories={categoryOptions}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      <div
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe pt-4 sm:px-6 sm:pb-6"
        aria-busy={isLoading}
      >
        {results.length > 0 ? (
          <ul className={cn('grid grid-cols-1 gap-2 transition-opacity sm:grid-cols-2 lg:grid-cols-3', isLoading && 'opacity-60')}>
            {results.map((product) => {
              const isSelecting = selectingProductId === product.id;

              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    disabled={selectingProductId !== null}
                    className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/50 disabled:opacity-60"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl" aria-hidden="true">
                      {product.emoji || <Package className="size-5 text-ink-subtle" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{product.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">{product.category}</span>
                    </span>
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted transition group-hover:bg-primary group-hover:text-white"
                      aria-hidden="true"
                    >
                      {isSelecting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    </span>
                    <span className="sr-only">Add {product.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : isLoading ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={SearchX}
            title={emptyStateTitle}
            description={emptyStateDescription}
            className="border-0 bg-transparent"
            action={
              query.trim() ? (
                <Button
                  variant="outline"
                  onClick={() => handleSelectProduct({
                    id: 'custom',
                    name: query,
                    category: selectedCategory === ALL_CATEGORY_NAME ? 'Other' : selectedCategory,
                    emoji: null,
                    price: DEFAULT_BASE_PRICE_EGP,
                    popularity: 0,
                  })}
                  disabled={selectingProductId !== null}
                >
                  <Plus aria-hidden="true" />
                  Add &quot;{query.trim()}&quot; anyway
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
