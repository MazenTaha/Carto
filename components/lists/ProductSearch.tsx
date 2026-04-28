'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Product {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  price: number;
}

interface ProductSearchProps {
  onSelect: (product: Product) => void;
  onCancel: () => void;
}

export function ProductSearch({ onSelect, onCancel }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    inputRef.current?.focus();
    fetchProducts('');
  }, []);

  useEffect(() => {
    fetchProducts(debouncedQuery);
  }, [debouncedQuery]);

  const fetchProducts = async (search: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(search)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data);
        setShowPopular(!search);
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full overflow-hidden">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <Badge variant="success">Product finder</Badge>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Find Products</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Search or choose popular products for this list.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close product search">
          <span className="material-symbols-outlined">close</span>
        </Button>
      </div>

      <div className="relative mb-5">
        <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search milk, apples, coffee..."
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {isLoading && (
          <div className="absolute right-5 top-1/2 size-5 -translate-y-1/2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        )}
      </div>

      {showPopular && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['Popular', 'Recent', 'Favorites'].map((label, index) => (
            <button
              key={label}
              type="button"
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                index === 0
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[54vh] overflow-y-auto custom-scrollbar pr-1 md:max-h-[430px]">
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
          {results.length > 0 ? (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900"
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
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </span>
              </button>
            ))
          ) : (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-3xl">search_off</span>
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-200">No matching products found.</p>
              {query.trim() && (
                <Button className="mt-5" variant="outline" onClick={() => onSelect({ id: 'custom', name: query, category: 'Other', emoji: null, price: 0 })}>
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
