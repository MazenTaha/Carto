'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CategoryFilter } from '@/components/lists/CategoryFilter';
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
  onCancel: () => void;
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

export function ProductSearch({ onSelect, onCancel }: ProductSearchProps) {
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Badge variant="success">Product finder</Badge>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Find Products</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Search or choose popular products for this list.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Back to list">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Button>
        </div>

        <div className="relative mb-4">
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search milk, apples, coffee..."
            className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {(isLoading || isCategoryLoading) && (
            <div className="absolute right-5 top-1/2 size-5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          )}
        </div>

        <div className="mb-4">
          <CategoryFilter
            categories={categoryOptions}
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={isActive}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain pr-1 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
          {results.length > 0 ? (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectProduct(product)}
                disabled={selectingProductId !== null}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl text-primary">
                    {product.emoji || <span className="material-symbols-outlined">inventory_2</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-950 dark:text-slate-100">{product.name}</div>
                    <div className="mt-0.5 truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{product.category}</div>
                  </div>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-primary group-hover:text-white dark:bg-slate-800">
                  <span className={`material-symbols-outlined text-[20px] ${selectingProductId === product.id ? 'animate-spin' : ''}`}>
                    {selectingProductId === product.id ? 'progress_activity' : 'add'}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-3xl">search_off</span>
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-200">{emptyStateTitle}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{emptyStateDescription}</p>
              {query.trim() && (
                <Button
                  className="mt-5"
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
                  Add &quot;{query}&quot; anyway
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
