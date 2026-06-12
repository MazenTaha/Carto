'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListItem } from '@/types';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { ProductSearch } from '@/components/lists/ProductSearch';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { cn, formatCurrency } from '@/lib/utils';

interface ListItemsManagerProps {
  listId: string;
  listName: string;
  initialItems: ListItem[];
  isLockedForActiveSession?: boolean;
}

const activeSessionLockMessage = 'This list is active on a cart. Finish the session before editing it.';

type ApiErrorPayload = {
  error?: string | { code?: string; message?: string };
  data?: any;
};

type DeletedListItem = Pick<ListItem, 'id' | 'name' | 'quantity' | 'category' | 'price'>;

export function ListItemsManager({
  listId,
  listName,
  initialItems,
  isLockedForActiveSession = false,
}: ListItemsManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isItemsLoading, setIsItemsLoading] = useState(initialItems.length === 0);
  const [isActivating, setIsActivating] = useState(false);
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [quantitySyncItemIds, setQuantitySyncItemIds] = useState<Set<string>>(new Set());
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [deletedItems, setDeletedItems] = useState<DeletedListItem[]>([]);
  const itemsRequestInFlightRef = useRef(false);
  const itemsRef = useRef<ListItem[]>(initialItems);
  const quantityRequestsRef = useRef(
    new Map<string, { confirmedQuantity: number; desiredQuantity: number; inFlight: boolean }>()
  );

  const markItemPending = useCallback((itemId: string) => {
    setPendingItemIds((current) => new Set(current).add(itemId));
  }, []);

  const clearItemPending = useCallback((itemId: string) => {
    setPendingItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }, []);

  const markQuantitySync = useCallback((itemId: string) => {
    setQuantitySyncItemIds((current) => new Set(current).add(itemId));
  }, []);

  const clearQuantitySync = useCallback((itemId: string) => {
    setQuantitySyncItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }, []);

  const readErrorPayload = useCallback(async (response: Response, fallback: string) => {
    try {
      const data: ApiErrorPayload = await response.json();
      const message = typeof data.error === 'string'
        ? data.error
        : data.error?.message || fallback;
      const code = typeof data.error === 'object' ? data.error?.code : undefined;
      return {
        code,
        message,
        data: data.data,
      };
    } catch {
      return {
        code: undefined,
        message: fallback,
        data: undefined,
      };
    }
  }, []);

  const mergeItemsWithPendingQuantities = useCallback((nextItems: ListItem[]) => (
    nextItems.map((item) => {
      const pendingQuantity = quantityRequestsRef.current.get(item.id);

      if (!pendingQuantity) {
        return item;
      }

      return {
        ...item,
        quantity: pendingQuantity.desiredQuantity,
      };
    })
  ), []);

  const syncItemsFromServer = useCallback(async (options?: { showLoader?: boolean }) => {
    if (itemsRequestInFlightRef.current) {
      return false;
    }

    itemsRequestInFlightRef.current = true;
    if (options?.showLoader) {
      setIsItemsLoading(true);
    }

    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Failed to refresh list items.');
        throw new Error(payload.message);
      }

      const data = await response.json();
      const nextItems = Array.isArray(data?.data) ? data.data : [];
      setItems(mergeItemsWithPendingQuantities(nextItems));
      return true;
    } catch (err: any) {
      setError((current) => current || err.message || 'Failed to refresh list items.');
      return false;
    } finally {
      itemsRequestInFlightRef.current = false;
      setIsItemsLoading(false);
    }
  }, [listId, mergeItemsWithPendingQuantities, readErrorPayload]);

  useEffect(() => {
    setItems(mergeItemsWithPendingQuantities(initialItems));
    setIsItemsLoading(false);
  }, [initialItems, listId, mergeItemsWithPendingQuantities]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    void syncItemsFromServer({ showLoader: initialItems.length === 0 });
  }, [initialItems.length, syncItemsFromServer]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void syncItemsFromServer();
    };

    const handlePageShow = () => {
      void syncItemsFromServer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncItemsFromServer();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncItemsFromServer]);

  const handleAddItem = useCallback(async (name: string, category?: string | null) => {
    const trimmedName = name.trim();
    if (!trimmedName || isLoading) return false;
    if (isLockedForActiveSession) {
      setError(activeSessionLockMessage);
      return false;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticItem: ListItem = {
      id: optimisticId,
      name: trimmedName,
      quantity: 1,
      price: 0,
      category: category || null,
      isCollected: false,
      collectedAt: null,
      listId,
    };

    setIsLoading(true);
    markItemPending(optimisticId);
    setError('');
    setNotice('');
    setSearchTerm('');
    setItems((current) => [...current, optimisticItem]);

    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          quantity: 1,
          price: 0,
          category: category || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Failed to add item');

        if (payload.code === 'DUPLICATE_LIST_ITEM') {
          await syncItemsFromServer();
        }

        throw new Error(payload.message);
      }

      const data = await response.json();
      if (data.success && data.data) {
        setItems((current) => current.map((item) => (item.id === optimisticId ? data.data : item)));
        setNotice('Item added.');
        router.refresh();
      }
      return true;
    } catch (err: any) {
      setItems((current) => current.filter((item) => item.id !== optimisticId));
      setSearchTerm(trimmedName);
      setError(err.message || 'Failed to add item.');
      return false;
    } finally {
      clearItemPending(optimisticId);
      setIsLoading(false);
    }
  }, [clearItemPending, isLoading, isLockedForActiveSession, listId, markItemPending, readErrorPayload, router, syncItemsFromServer]);

  const flushQuantityUpdate = useCallback(async (itemId: string) => {
    const requestState = quantityRequestsRef.current.get(itemId);

    if (!requestState || requestState.inFlight) {
      return;
    }

    if (requestState.desiredQuantity === requestState.confirmedQuantity) {
      quantityRequestsRef.current.delete(itemId);
      clearQuantitySync(itemId);
      return;
    }

    requestState.inFlight = true;
    markQuantitySync(itemId);
    const requestedQuantity = requestState.desiredQuantity;

    try {
      const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: requestedQuantity }),
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Could not update quantity.');
        throw new Error(payload.message);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Could not update quantity.');
      }

      const latestRequestState = quantityRequestsRef.current.get(itemId);

      if (!latestRequestState) {
        return;
      }

      latestRequestState.confirmedQuantity = data.data.quantity ?? requestedQuantity;
      latestRequestState.inFlight = false;

      const visibleQuantity = latestRequestState.desiredQuantity !== requestedQuantity
        ? latestRequestState.desiredQuantity
        : latestRequestState.confirmedQuantity;

      setItems((current) => current.map((entry) => (
        entry.id === itemId
          ? { ...entry, ...data.data, quantity: visibleQuantity }
          : entry
      )));

      if (latestRequestState.desiredQuantity !== latestRequestState.confirmedQuantity) {
        void flushQuantityUpdate(itemId);
        return;
      }

      quantityRequestsRef.current.delete(itemId);
      clearQuantitySync(itemId);
    } catch (err: any) {
      const latestRequestState = quantityRequestsRef.current.get(itemId);
      const rollbackQuantity = latestRequestState?.confirmedQuantity;

      if (typeof rollbackQuantity === 'number') {
        setItems((current) => current.map((entry) => (
          entry.id === itemId
            ? { ...entry, quantity: rollbackQuantity }
            : entry
        )));
      }

      quantityRequestsRef.current.delete(itemId);
      clearQuantitySync(itemId);
      setError(err.message || 'Could not update quantity.');
    }
  }, [clearQuantitySync, listId, markQuantitySync, readErrorPayload]);

  const handleUpdateQuantity = async (itemId: string, delta: number) => {
    if (pendingItemIds.has(itemId)) return;
    if (isLockedForActiveSession) {
      setError(activeSessionLockMessage);
      return;
    }

    const currentItem = itemsRef.current.find((entry) => entry.id === itemId);

    if (!currentItem) {
      return;
    }

    const existingRequestState = quantityRequestsRef.current.get(itemId);
    const currentQuantity = existingRequestState?.desiredQuantity ?? currentItem.quantity;
    const newQuantity = Math.max(1, currentQuantity + delta);

    if (newQuantity === currentQuantity) return;

    quantityRequestsRef.current.set(itemId, {
      confirmedQuantity: existingRequestState?.confirmedQuantity ?? currentItem.quantity,
      desiredQuantity: newQuantity,
      inFlight: existingRequestState?.inFlight ?? false,
    });

    markQuantitySync(itemId);
    setError('');
    setNotice('');

    setItems((current) => current.map((entry) => (
      entry.id === itemId
        ? { ...entry, quantity: newQuantity }
        : entry
    )));

    if (!existingRequestState?.inFlight) {
      void flushQuantityUpdate(itemId);
    }
  };

  const handleDeleteItem = async (item: ListItem) => {
    if (pendingItemIds.has(item.id)) return;
    if (isLockedForActiveSession) {
      setError(activeSessionLockMessage);
      return;
    }
    markItemPending(item.id);
    setError('');
    setNotice('');
    setItems((current) => current.filter((entry) => entry.id !== item.id));

    try {
      const response = await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Could not delete item.');
        throw new Error(payload.message);
      }
      setDeletedItems((current) => [
        {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          price: item.price,
        },
        ...current.filter((entry) => entry.id !== item.id),
      ]);
      setNotice('Item deleted.');
      router.refresh();
    } catch (err) {
      setItems((current) => {
        if (current.some((entry) => entry.id === item.id)) return current;
        return [...current, item];
      });
      setError('Could not delete item.');
    } finally {
      clearItemPending(item.id);
    }
  };

  const handleRestoreDeletedItem = useCallback(async (item: DeletedListItem) => {
    if (isLockedForActiveSession || isLoading) {
      if (isLockedForActiveSession) {
        setError(activeSessionLockMessage);
      }
      return;
    }

    markItemPending(item.id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          price: item.price || 0,
          category: item.category || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Could not restore item.');

        if (payload.code === 'DUPLICATE_LIST_ITEM') {
          await syncItemsFromServer();
        }

        throw new Error(payload.message);
      }

      const data = await response.json();
      if (data.success && data.data) {
        setItems((current) => [...current, data.data]);
        setDeletedItems((current) => current.filter((entry) => entry.id !== item.id));
        setNotice('Item restored.');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Could not restore item.');
    } finally {
      clearItemPending(item.id);
    }
  }, [clearItemPending, isLoading, isLockedForActiveSession, listId, markItemPending, readErrorPayload, router, syncItemsFromServer]);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    [items]
  );

  const renderItem = (item: ListItem) => (
    (() => {
      const isPending = pendingItemIds.has(item.id);
      const isQuantitySyncing = quantitySyncItemIds.has(item.id);
      const isBusy = isPending || isQuantitySyncing;
      const itemMeta = [item.category || 'General', item.price ? formatCurrency(item.price) : null]
        .filter(Boolean)
        .join(' | ');
      return (
    <article
      key={item.id}
      className={cn(
        'flex min-h-[92px] w-full max-w-full items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition dark:bg-slate-900 sm:p-4',
        isBusy && 'opacity-70',
        'border-slate-200 hover:border-primary/30 hover:shadow-card dark:border-slate-800'
      )}
    >
      <div className="min-w-0 flex-1 self-center">
        <h3 className="break-words text-base font-bold leading-5 text-slate-950 dark:text-slate-100">
          {item.name}
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-500">{itemMeta}</p>
      </div>

      <div className="ml-auto flex w-[122px] shrink-0 items-center justify-end gap-2 self-center">
        <div className={cn('flex h-11 flex-1 items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800', isQuantitySyncing && 'ring-1 ring-primary/15')}>
          <button
            type="button"
            onClick={() => handleUpdateQuantity(item.id, -1)}
            disabled={isPending || isLockedForActiveSession || item.quantity <= 1}
            className="flex size-8 items-center justify-center rounded-full text-primary transition active:scale-90 hover:bg-white disabled:opacity-40 disabled:active:scale-100 dark:hover:bg-slate-700"
            aria-label={`Decrease ${item.name} quantity`}
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="min-w-[1.75rem] text-center text-sm font-black tabular-nums">{item.quantity}</span>
          <button
            type="button"
            onClick={() => handleUpdateQuantity(item.id, 1)}
            disabled={isPending || isLockedForActiveSession}
            className="flex size-8 items-center justify-center rounded-full text-primary transition active:scale-90 hover:bg-white disabled:opacity-40 disabled:active:scale-100 dark:hover:bg-slate-700"
            aria-label={`Increase ${item.name} quantity`}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleDeleteItem(item)}
          disabled={isBusy || isLockedForActiveSession}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:active:scale-100 dark:hover:bg-red-500/10"
          aria-label={`Delete ${item.name}`}
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
      </div>
    </article>
      );
    })()
  );

  return (
    <PageContainer maxWidth="lg">
      <Header
        title={listName}
        showBack
        showLogo
        rightElement={
          <Button
            size="sm"
            onClick={() => {
              setIsActivating(true);
              router.push(`/session/start?listId=${listId}`);
            }}
            disabled={isActivating}
          >
            <span className={cn('material-symbols-outlined text-[18px]', isActivating && 'animate-spin')}>
              {isActivating ? 'progress_activity' : 'qr_code_scanner'}
            </span>
            <span className="hidden sm:inline">{isActivating ? 'Opening' : 'Activate'}</span>
          </Button>
        }
      />

      <main className="flex-1 pb-28 pt-6 md:pb-10">
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft md:p-6">
            <Badge className="bg-white/10 text-white ring-white/15">
              {isLockedForActiveSession ? 'Active on cart' : 'Shopping list'}
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{listName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              {isLockedForActiveSession
                ? 'This list is currently assigned to a cart. Finish the session before changing it.'
                : 'Keep the list ready, then activate it to link with the QR code on a cart.'}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">List summary</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xl font-black">{items.length}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <p className="text-xl font-black">{deletedItems.length}</p>
                <p className="text-xs font-bold">Deleted</p>
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
              onClick={() => {
                if (!isLockedForActiveSession) setIsProductSearchOpen(true);
              }}
              disabled={isLockedForActiveSession}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900"
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
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void handleAddItem(searchTerm);
              }}
              disabled={isLoading || isLockedForActiveSession}
            />
            <Button
              size="icon"
              onClick={() => handleAddItem(searchTerm)}
              disabled={isLoading || isLockedForActiveSession || !searchTerm.trim()}
              aria-label="Add item"
            >
              <span className={cn('material-symbols-outlined', isLoading && 'animate-spin')}>{isLoading ? 'progress_activity' : 'add'}</span>
            </Button>
          </div>
          {isLockedForActiveSession && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {activeSessionLockMessage}
            </p>
          )}
          {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {notice && !error && <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary">{notice}</p>}
        </section>

        {isItemsLoading && items.length === 0 ? (
          <div className="mt-6">
            <LoadingState label="Loading list items" />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                  Items ({items.length})
                </h2>
              </div>
              <div className="space-y-3">
                {items.length > 0 ? (
                  items.map((item) => renderItem(item))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    No active items yet.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                  Deleted items ({deletedItems.length})
                </h2>
              </div>
              <div className="space-y-3">
                {deletedItems.length > 0 ? (
                  deletedItems.map((item) => {
                    const isPending = pendingItemIds.has(item.id);
                    return (
                      <article
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900',
                          isPending && 'opacity-70'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-bold text-slate-950 dark:text-slate-100">{item.name}</h3>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Qty: {item.quantity}
                            {item.category ? ` | ${item.category}` : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestoreDeletedItem(item)}
                          disabled={isPending || isLockedForActiveSession}
                        >
                          Restore
                        </Button>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    Deleted items will appear here.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {isProductSearchOpen && !isLockedForActiveSession && (
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
                await handleAddItem(product.name, product.category);
              }}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </PageContainer>
  );
}
