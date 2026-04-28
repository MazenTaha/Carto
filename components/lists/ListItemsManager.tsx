'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListItem } from '@/types';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ProductSearch } from '@/components/lists/ProductSearch';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn, formatCurrency } from '@/lib/utils';

interface ListItemsManagerProps {
  listId: string;
  listName: string;
  initialItems: ListItem[];
}

export function ListItemsManager({ listId, listName, initialItems }: ListItemsManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/items`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {
      setError('Could not refresh list items.');
    }
  };

  const handleAddItem = async (name: string, category?: string | null) => {
    if (!name.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          quantity: 1,
          price: 0,
          category: category || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      setSearchTerm('');
      await fetchItems();
    } catch (err: any) {
      setError(err.message || 'Failed to add item.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuantity = async (item: ListItem, delta: number) => {
    const newQuantity = Math.max(1, item.quantity + delta);
    if (newQuantity === item.quantity) return;

    try {
      await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      fetchItems();
    } catch (err) {
      setError('Could not update quantity.');
    }
  };

  const handleToggleCollected = async (item: ListItem) => {
    try {
      await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCollected: !item.isCollected }),
      });
      fetchItems();
    } catch (err) {
      setError('Could not update item status.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
      });
      fetchItems();
    } catch (err) {
      setError('Could not delete item.');
    }
  };

  const notCollected = items.filter((item) => !item.isCollected);
  const collected = items.filter((item) => item.isCollected);
  const progress = items.length > 0 ? Math.round((collected.length / items.length) * 100) : 0;
  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    [items]
  );

  const renderItem = (item: ListItem, isCollected: boolean) => (
    <article
      key={item.id}
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition dark:bg-slate-900 sm:p-4',
        isCollected
          ? 'border-slate-100 opacity-70 dark:border-slate-800'
          : 'border-slate-200 hover:border-primary/30 hover:shadow-card dark:border-slate-800'
      )}
    >
      <button
        type="button"
        onClick={() => handleToggleCollected(item)}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition',
          isCollected
            ? 'border-primary bg-primary text-white'
            : 'border-slate-300 bg-white text-transparent hover:border-primary dark:border-slate-700 dark:bg-slate-950'
        )}
        aria-label={isCollected ? `Mark ${item.name} as not collected` : `Mark ${item.name} as collected`}
      >
        <span className="material-symbols-outlined text-[20px]">check</span>
      </button>

      <div className="min-w-0 flex-1">
        <h3 className={cn('truncate text-base font-bold text-slate-950 dark:text-slate-100', isCollected && 'line-through')}>
          {item.name}
        </h3>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
          {item.category || 'General'}
          {item.price ? ` • ${formatCurrency(item.price)}` : ''}
        </p>
      </div>

      {!isCollected ? (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleUpdateQuantity(item, -1)}
              className="flex size-8 items-center justify-center rounded-full text-primary transition hover:bg-white dark:hover:bg-slate-700"
              aria-label={`Decrease ${item.name} quantity`}
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="w-7 text-center text-sm font-black">{item.quantity}</span>
            <button
              type="button"
              onClick={() => handleUpdateQuantity(item, 1)}
              className="flex size-8 items-center justify-center rounded-full text-primary transition hover:bg-white dark:hover:bg-slate-700"
              aria-label={`Increase ${item.name} quantity`}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleDeleteItem(item.id)}
            className="flex size-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            aria-label={`Delete ${item.name}`}
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      ) : (
        <Badge variant="success">{item.quantity} collected</Badge>
      )}
    </article>
  );

  return (
    <PageContainer maxWidth="lg">
      <Header
        title={listName}
        showBack
        rightElement={
          <Button size="sm" onClick={() => router.push(`/session/start?listId=${listId}`)}>
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span className="hidden sm:inline">Activate</span>
          </Button>
        }
      />

      <main className="flex-1 pb-28 pt-6 md:pb-10">
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft md:p-6">
            <Badge className="bg-white/10 text-white ring-white/15">Shopping list</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{listName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Keep the list ready, then activate it to link with the QR code on a cart.
            </p>
            <div className="mt-5">
              <ProgressBar value={progress} label="Collection progress" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">List summary</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xl font-black">{items.length}</p>
                <p className="text-xs text-slate-500">Items</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <p className="text-xl font-black">{collected.length}</p>
                <p className="text-xs font-bold">Done</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xl font-black">{formatCurrency(estimatedTotal)}</p>
                <p className="text-xs text-slate-500">Est.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sticky top-[65px] z-30 -mx-4 mt-5 border-y border-slate-200/70 bg-background-light/95 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-background-dark/95 sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setIsProductSearchOpen(true)}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition hover:bg-primary hover:text-white dark:border-slate-800 dark:bg-slate-900"
              aria-label="Open product search"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
            <label className="sr-only" htmlFor="quick-add-item">Quick add item</label>
            <input
              id="quick-add-item"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Quick add item and press Enter"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleAddItem(searchTerm)}
            />
            <Button size="icon" onClick={() => handleAddItem(searchTerm)} disabled={isLoading || !searchTerm.trim()} aria-label="Add item">
              <span className="material-symbols-outlined">add</span>
            </Button>
          </div>
          {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        </section>

        {items.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon="add_shopping_cart"
            title="This list is empty"
            description="Add products from search or quick add. Once this list has items, activate it to link with a cart."
            action={
              <Button onClick={() => setIsProductSearchOpen(true)}>
                <span className="material-symbols-outlined">search</span>
                Browse products
              </Button>
            }
          />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                  Not collected ({notCollected.length})
                </h2>
                <Badge variant="warning">Ready for cart</Badge>
              </div>
              <div className="space-y-3">
                {notCollected.length > 0 ? (
                  notCollected.map((item) => renderItem(item, false))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    All items are collected.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                  Collected ({collected.length})
                </h2>
                <Badge variant="success">{progress}% done</Badge>
              </div>
              <div className="space-y-3">
                {collected.length > 0 ? (
                  collected.map((item) => renderItem(item, true))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    Collected items will appear here.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {isProductSearchOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Close product search"
            onClick={() => setIsProductSearchOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 md:bottom-auto md:top-10 md:mx-auto md:w-[min(920px,calc(100%-2rem))] md:rounded-3xl md:p-6">
            <ProductSearch
              onCancel={() => setIsProductSearchOpen(false)}
              onSelect={async (product) => {
                await handleAddItem(product.name, product.category);
                setIsProductSearchOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </PageContainer>
  );
}
