'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ProductSearch } from '@/components/lists/ProductSearch';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EMPTY_LIST_MESSAGE } from '@/lib/list-constants';
import { formatListItemName, normalizeListItemName } from '@/lib/list-items';
import { createListSchema } from '@/lib/validations';
import { cn, formatCurrency } from '@/lib/utils';

type DraftListItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string | null;
};

export default function NewListPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [quickItemName, setQuickItemName] = useState('');
  const [items, setItems] = useState<DraftListItem[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const addDraftItem = (rawName: string, category?: string | null) => {
    const trimmedName = rawName.trim();

    if (!trimmedName) {
      return;
    }

    const normalizedName = normalizeListItemName(trimmedName);
    const existingItem = items.find((item) => normalizeListItemName(item.name) === normalizedName);

    setError('');
    setNotice('');

    if (existingItem) {
      setItems((current) => current.map((item) => (
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )));
      setNotice(`Increased quantity for "${existingItem.name}".`);
      setQuickItemName('');
      return;
    }

    setItems((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${current.length}`,
        name: formatListItemName(trimmedName),
        quantity: 1,
        price: 0,
        category: category || null,
      },
    ]);
    setQuickItemName('');
    setNotice('Item added.');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      return {
        ...item,
        quantity: Math.max(1, item.quantity + delta),
      };
    }));
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setNotice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    try {
      createListSchema.parse({ name });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || err?.message || 'Please enter a list name.');
      return;
    }

    if (items.length === 0) {
      setError(EMPTY_LIST_MESSAGE);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          items: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            category: item.category || undefined,
          })),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || 'Failed to create list');
      }

      router.push(`/lists/${data.data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer maxWidth="lg">
      <Header title="Create List" showBack showLogo />

      <main className="flex-1 pb-28 pt-6 md:pb-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-soft md:p-7">
            <Badge className="bg-white/10 text-white ring-white/15">Draft list</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Build your next shopping list</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Name the list, add at least one item, then save it when you are ready.
            </p>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Summary</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xl font-black">{items.length}</p>
                <p className="text-xs text-slate-500">Items</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <p className="text-xl font-black">{items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                <p className="text-xs font-bold">Qty</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xl font-black">{formatCurrency(estimatedTotal)}</p>
                <p className="text-xs text-slate-500">Est.</p>
              </div>
            </div>
          </aside>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label className="block">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">List Name</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Groceries"
                className="mt-3 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                required
                autoFocus
                name="name"
              />
            </label>

            <div className="mt-5 flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setIsProductSearchOpen(true)}
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition hover:bg-primary hover:text-white dark:border-slate-800 dark:bg-slate-900"
                aria-label="Open product search"
              >
                <span className="material-symbols-outlined">search</span>
              </button>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Quick add item and press Enter"
                value={quickItemName}
                onChange={(event) => setQuickItemName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addDraftItem(quickItemName);
                }}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => addDraftItem(quickItemName)}
                disabled={!quickItemName.trim()}
                aria-label="Add item"
              >
                <span className="material-symbols-outlined">add</span>
              </Button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {notice && !error && (
              <div className="mt-4 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                {notice}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Items ({items.length})</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add at least one item before saving this list.</p>
              </div>
            </div>

            <div className="space-y-3">
              {items.length > 0 ? (
                items.map((item) => {
                  const itemMeta = [item.category || 'General', item.price ? formatCurrency(item.price) : null]
                    .filter(Boolean)
                    .join(' | ');

                  return (
                    <article
                      key={item.id}
                      className="flex min-h-[92px] w-full max-w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-4"
                    >
                      <div className="min-w-0 flex-1 self-center">
                        <h3 className="break-words text-base font-bold leading-5 text-slate-950 dark:text-slate-100">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">{itemMeta}</p>
                      </div>

                      <div className="ml-auto flex w-[122px] shrink-0 items-center justify-end gap-2 self-center">
                        <div className="flex h-11 flex-1 items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={item.quantity <= 1}
                            className="flex size-8 items-center justify-center rounded-full text-primary transition active:scale-90 hover:bg-white disabled:opacity-40 disabled:active:scale-100 dark:hover:bg-slate-700"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            <span className="material-symbols-outlined text-[18px]">remove</span>
                          </button>
                          <span className="min-w-[1.75rem] text-center text-sm font-black tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex size-8 items-center justify-center rounded-full text-primary transition active:scale-90 hover:bg-white dark:hover:bg-slate-700"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-200 active:scale-90 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label={`Delete ${item.name}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {EMPTY_LIST_MESSAGE}
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              className="h-12 flex-1 rounded-2xl"
              disabled={isLoading}
            >
              <span className={cn('material-symbols-outlined text-[18px]', isLoading && 'animate-spin')}>
                {isLoading ? 'progress_activity' : 'save'}
              </span>
              {isLoading ? 'Saving...' : 'Save List'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>

      {isProductSearchOpen && (
        <div className="fixed inset-0 z-[100] flex max-h-dvh items-end justify-center overflow-hidden md:items-start md:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Close product search"
            onClick={() => setIsProductSearchOpen(false)}
          />
          <div className="relative z-10 flex max-h-dvh min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white p-4 pb-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 md:mt-6 md:max-h-[calc(100dvh-3rem)] md:w-[min(920px,calc(100%-2rem))] md:rounded-3xl md:p-6 md:pb-0">
            <ProductSearch
              onCancel={() => setIsProductSearchOpen(false)}
              onSelect={async (product) => {
                setIsProductSearchOpen(false);
                addDraftItem(product.name, product.category);
              }}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </PageContainer>
  );
}
