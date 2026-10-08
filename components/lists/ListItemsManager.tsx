'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListItem } from '@/types';
import {
  CircleCheck,
  Loader2,
  Lock,
  Minus,
  PackageSearch,
  Plus,
  ScanLine,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
  Undo2,
} from 'lucide-react';
import { AppShell, MobileActionBar } from '@/components/layout/AppShell';
import { ProductSearch } from '@/components/lists/ProductSearch';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { inputClassName } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { normalizeListItemName } from '@/lib/list-items';
import { EMPTY_LIST_MESSAGE } from '@/lib/list-constants';
import { DEFAULT_BASE_PRICE_EGP, normalizeBasePriceEGP } from '@/lib/pricing';
import { cn, formatCurrency } from '@/lib/utils';

interface ListItemsManagerProps {
  listId: string;
  listName: string;
  initialItems: ListItem[];
  isLockedForActiveSession?: boolean;
  activeSession?: {
    sessionId: string;
    cartCode: string;
    shoppingList: {
      id: string;
      name: string;
      itemsCount: number;
    };
  } | null;
}

const activeSessionLockMessage = 'This list is active on a cart. Finish the session before editing it.';
const existingSessionMessage = 'You already have an active cart session. Finish or disconnect it before starting another list.';

type ApiErrorPayload = {
  error?: string | { code?: string; message?: string };
  data?: any;
};

type DeletedListItem = Pick<ListItem, 'id' | 'name' | 'quantity' | 'category' | 'price'>;

function toDeletedListItem(item: Pick<ListItem, 'id' | 'name' | 'quantity' | 'category' | 'price'>): DeletedListItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    price: item.price,
  };
}

export function ListItemsManager({
  listId,
  listName,
  initialItems,
  isLockedForActiveSession = false,
  activeSession = null,
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

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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

  const upsertDeletedItem = useCallback((item: DeletedListItem) => {
    setDeletedItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
  }, []);

  const removeDeletedItem = useCallback((itemId: string) => {
    setDeletedItems((current) => current.filter((entry) => entry.id !== itemId));
  }, []);

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
      price: DEFAULT_BASE_PRICE_EGP,
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
          price: DEFAULT_BASE_PRICE_EGP,
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
  }, [clearItemPending, isLoading, isLockedForActiveSession, listId, markItemPending, readErrorPayload, syncItemsFromServer]);

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
    const deletedItem = toDeletedListItem(item);
    markItemPending(item.id);
    setError('');
    setNotice('');
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    upsertDeletedItem(deletedItem);

    try {
      const response = await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await readErrorPayload(response, 'Could not delete item.');
        throw new Error(payload.message);
      }
      setNotice('Item deleted.');
    } catch (err: any) {
      setItems((current) => {
        if (current.some((entry) => entry.id === item.id)) return current;
        return [...current, item];
      });
      removeDeletedItem(item.id);
      setError(err.message || 'Could not delete item.');
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

    const currentItems = itemsRef.current;
    const matchingActiveItem = currentItems.find((entry) => normalizeListItemName(entry.name) === normalizeListItemName(item.name));
    const optimisticRestoredItem: ListItem = {
      id: `restoring-${item.id}`,
      name: item.name,
      quantity: item.quantity,
      price: normalizeBasePriceEGP(item.price),
      category: item.category || null,
      isCollected: false,
      collectedAt: null,
      listId,
    };
    const targetQuantity = matchingActiveItem ? matchingActiveItem.quantity + item.quantity : item.quantity;

    markItemPending(item.id);
    if (matchingActiveItem) {
      markItemPending(matchingActiveItem.id);
    }
    setError('');
    setNotice('');
    removeDeletedItem(item.id);

    if (matchingActiveItem) {
      setItems((current) => current.map((entry) => (
        entry.id === matchingActiveItem.id
          ? { ...entry, quantity: targetQuantity }
          : entry
      )));
    } else {
      setItems((current) => [...current, optimisticRestoredItem]);
    }

    try {
      if (matchingActiveItem) {
        const response = await fetch(`/api/lists/${listId}/items/${matchingActiveItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: targetQuantity }),
        });

        if (!response.ok) {
          const payload = await readErrorPayload(response, 'Could not restore item.');
          throw new Error(payload.message);
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          throw new Error('Could not restore item.');
        }

        setItems((current) => current.map((entry) => (
          entry.id === matchingActiveItem.id
            ? { ...entry, ...data.data, quantity: targetQuantity }
            : entry
        )));
      } else {
        const response = await fetch(`/api/lists/${listId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            quantity: item.quantity,
            price: normalizeBasePriceEGP(item.price),
            category: item.category || undefined,
          }),
        });

        if (!response.ok) {
          const payload = await readErrorPayload(response, 'Could not restore item.');

          if (payload.code === 'DUPLICATE_LIST_ITEM' && payload.data?.existingItem?.id) {
            const mergedItemId = String(payload.data.existingItem.id);
            const latestExistingItem = itemsRef.current.find((entry) => entry.id === mergedItemId)
              || currentItems.find((entry) => entry.id === mergedItemId);
            const mergedQuantity = (latestExistingItem?.quantity ?? payload.data.existingItem.quantity ?? 0) + item.quantity;

            const mergeResponse = await fetch(`/api/lists/${listId}/items/${mergedItemId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quantity: mergedQuantity }),
            });

            if (!mergeResponse.ok) {
              const mergePayload = await readErrorPayload(mergeResponse, 'Could not restore item.');
              throw new Error(mergePayload.message);
            }

            const mergeData = await mergeResponse.json();
            if (!mergeData.success || !mergeData.data) {
              throw new Error('Could not restore item.');
            }

            setItems((current) => {
              const withoutOptimistic = current.filter((entry) => entry.id !== optimisticRestoredItem.id);
              const alreadyVisible = withoutOptimistic.some((entry) => entry.id === mergedItemId);

              if (!alreadyVisible) {
                return [...withoutOptimistic, { ...mergeData.data, quantity: mergedQuantity }];
              }

              return withoutOptimistic.map((entry) => (
                entry.id === mergedItemId
                  ? { ...entry, ...mergeData.data, quantity: mergedQuantity }
                  : entry
              ));
            });
            setNotice('Item restored.');
            return;
          }

          throw new Error(payload.message);
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          throw new Error('Could not restore item.');
        }

        setItems((current) => current.map((entry) => (
          entry.id === optimisticRestoredItem.id ? data.data : entry
        )));
      }

      setNotice('Item restored.');
    } catch (err: any) {
      upsertDeletedItem(item);
      if (matchingActiveItem) {
        setItems(currentItems);
      } else {
        setItems((current) => current.filter((entry) => entry.id !== optimisticRestoredItem.id));
      }
      setError(err.message || 'Could not restore item.');
    } finally {
      clearItemPending(item.id);
      if (matchingActiveItem) {
        clearItemPending(matchingActiveItem.id);
      }
    }
  }, [clearItemPending, isLoading, isLockedForActiveSession, listId, markItemPending, readErrorPayload, removeDeletedItem, upsertDeletedItem]);

  const hasOwnedActiveSession = Boolean(activeSession?.sessionId);
  const isCurrentListSession = activeSession?.shoppingList.id === listId;

  const handleActivationClick = useCallback(() => {
    if (itemsRef.current.length === 0) {
      setError(EMPTY_LIST_MESSAGE);
      return;
    }

    if (isCurrentListSession && activeSession?.sessionId) {
      router.push(`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`);
      return;
    }

    if (hasOwnedActiveSession) {
      setError(existingSessionMessage);
      return;
    }

    setIsActivating(true);
    router.push(`/session/start?listId=${listId}`);
  }, [activeSession?.sessionId, hasOwnedActiveSession, isCurrentListSession, listId, router]);

  const estimatedTotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const editingBlocked = isLockedForActiveSession || (hasOwnedActiveSession && !isCurrentListSession);
  const activationLabel = isActivating ? 'Opening scanner…' : isCurrentListSession ? 'Continue session' : 'Start shopping';
  const ActivationIcon = isCurrentListSession ? ShoppingCart : ScanLine;

  const renderItem = (item: ListItem) => {
    const isPending = pendingItemIds.has(item.id);
    const isQuantitySyncing = quantitySyncItemIds.has(item.id);
    const isBusy = isPending || isQuantitySyncing;
    const lineTotal = item.price ? formatCurrency(item.price * item.quantity) : null;

    return (
      <li
        key={item.id}
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-opacity duration-200 sm:px-5',
          isPending && 'opacity-60'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="break-words text-[0.9375rem] font-medium leading-5 text-ink">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">
            {item.category || 'General'}
            {item.price ? ` · ${formatCurrency(item.price)} each` : ''}
          </p>
        </div>

        {lineTotal && (
          <p className="tabular hidden w-24 shrink-0 text-right text-sm font-medium text-ink-muted sm:block">{lineTotal}</p>
        )}

        <div
          className={cn(
            'flex h-10 shrink-0 items-center rounded-full border border-line bg-surface-muted p-0.5',
            isQuantitySyncing && 'border-brand-200'
          )}
          role="group"
          aria-label={`${item.name} quantity`}
        >
          <button
            type="button"
            onClick={() => handleUpdateQuantity(item.id, -1)}
            disabled={isPending || isLockedForActiveSession || item.quantity <= 1}
            className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-surface active:scale-90 disabled:text-ink-subtle/50 disabled:hover:bg-transparent"
            aria-label={`Decrease ${item.name} quantity`}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="tabular min-w-[1.75rem] text-center text-sm font-semibold" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => handleUpdateQuantity(item.id, 1)}
            disabled={isPending || isLockedForActiveSession}
            className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-surface active:scale-90 disabled:text-ink-subtle/50 disabled:hover:bg-transparent"
            aria-label={`Increase ${item.name} quantity`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleDeleteItem(item)}
          disabled={isBusy || isLockedForActiveSession}
          className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-subtle transition hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label={`Remove ${item.name}`}
        >
          {isPending ? <Loader2 className="size-[1.125rem] animate-spin" aria-hidden="true" /> : <Trash2 className="size-[1.125rem]" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  return (
    <AppShell
      back="/lists"
      title={listName}
      bottomBar
      actions={
        <Button
          size="sm"
          onClick={handleActivationClick}
          loading={isActivating}
          className="hidden lg:inline-flex"
        >
          {!isActivating && <ActivationIcon aria-hidden="true" />}
          {activationLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            {isLockedForActiveSession || isCurrentListSession ? (
              <Badge tone="success" pulse>
                On cart {activeSession?.cartCode ?? ''}
              </Badge>
            ) : (
              <Badge tone="neutral">Shopping list</Badge>
            )}
          </div>
          <h1 className="break-words text-[1.75rem] font-bold leading-tight sm:text-[2rem]">{listName}</h1>
          <p className="tabular mt-1.5 text-[0.9375rem] text-ink-muted">
            {items.length} product{items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'} · Est.{' '}
            {formatCurrency(estimatedTotal)}
          </p>
        </div>
      </div>

      {editingBlocked && (
        <Alert
          tone={isCurrentListSession ? 'success' : 'warning'}
          icon={Lock}
          className="mt-5"
          title={hasOwnedActiveSession && !isCurrentListSession ? 'Another list is on a cart' : 'This list is on a cart'}
          action={
            activeSession?.sessionId ? (
              <ButtonLink href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`} size="sm" variant="outline">
                <ShoppingCart aria-hidden="true" />
                Open {activeSession.shoppingList.name}
              </ButtonLink>
            ) : undefined
          }
        >
          {hasOwnedActiveSession && !isCurrentListSession ? existingSessionMessage : activeSessionLockMessage}
        </Alert>
      )}

      <section aria-label="Add items" className="sticky top-16 z-20 -mx-4 mt-6 bg-canvas/95 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <form
          className="flex items-stretch gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddItem(searchTerm);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="quick-add-item">
              Add an item
            </label>
            <input
              id="quick-add-item"
              className={cn(inputClassName, 'pr-4')}
              placeholder={editingBlocked ? 'Editing is paused' : 'Add an item, e.g. Bananas'}
              value={searchTerm}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(event) => setSearchTerm(event.target.value)}
              disabled={isLoading || isLockedForActiveSession}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="size-12"
            disabled={isLoading || isLockedForActiveSession || !searchTerm.trim()}
            aria-label="Add item"
          >
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          </Button>
          <Button
            variant="outline"
            className="h-12 px-3 sm:px-4"
            onClick={() => {
              if (!isLockedForActiveSession) setIsProductSearchOpen(true);
            }}
            disabled={isLockedForActiveSession}
            aria-label="Browse products"
          >
            <PackageSearch aria-hidden="true" />
            <span className="hidden sm:inline">Browse</span>
          </Button>
        </form>
        <div aria-live="polite" className="min-h-0">
          {error ? (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          ) : notice ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CircleCheck className="size-4" aria-hidden="true" />
              {notice}
            </p>
          ) : null}
        </div>
      </section>

      {isItemsLoading && items.length === 0 ? (
        <div className="surface-card mt-4 divide-y divide-line" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          ))}
          <span className="sr-only">Loading list items</span>
        </div>
      ) : (
        <div className={cn('mt-4 grid items-start gap-6', deletedItems.length > 0 && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
          <section aria-labelledby="list-items-heading">
            <h2 id="list-items-heading" className="sr-only">
              Items
            </h2>
            {items.length > 0 ? (
              <ul className="surface-card divide-y divide-line overflow-hidden">{items.map((item) => renderItem(item))}</ul>
            ) : (
              <EmptyState
                icon={ShoppingBasket}
                title="This list is empty"
                description={`${EMPTY_LIST_MESSAGE} Type an item above or browse the catalog.`}
                action={
                  !isLockedForActiveSession ? (
                    <Button variant="outline" onClick={() => setIsProductSearchOpen(true)}>
                      <PackageSearch aria-hidden="true" />
                      Browse products
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>

          {deletedItems.length > 0 && (
            <section aria-labelledby="removed-items-heading">
              <h2 id="removed-items-heading" className="mb-3 text-sm font-semibold text-ink-muted">
                Removed from this list ({deletedItems.length})
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface/60">
                {deletedItems.map((item) => {
                  const isPending = pendingItemIds.has(item.id);
                  return (
                    <li key={item.id} className={cn('flex items-center gap-3 px-4 py-3', isPending && 'opacity-60')}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-muted line-through decoration-ink-subtle/40">{item.name}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          Qty {item.quantity}
                          {item.category ? ` · ${item.category}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRestoreDeletedItem(item)}
                        disabled={isPending || isLockedForActiveSession}
                        loading={isPending}
                      >
                        {!isPending && <Undo2 aria-hidden="true" />}
                        {isPending ? 'Restoring…' : 'Restore'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <MobileActionBar aboveNav>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-subtle">Estimated total</p>
            <p className="tabular truncate font-display text-lg font-semibold text-ink">{formatCurrency(estimatedTotal)}</p>
          </div>
          <Button onClick={handleActivationClick} loading={isActivating}>
            {!isActivating && <ActivationIcon aria-hidden="true" />}
            {activationLabel}
          </Button>
        </div>
      </MobileActionBar>

      <Modal
        open={isProductSearchOpen && !isLockedForActiveSession}
        onClose={() => setIsProductSearchOpen(false)}
        title="Add products"
        description="Search the catalog or pick from popular items."
        size="xl"
        className="h-[92dvh] sm:h-[min(88dvh,48rem)]"
        bodyClassName="flex flex-col overflow-hidden px-0 pb-0 sm:px-0 sm:pb-0"
      >
        <ProductSearch
          onCancel={() => setIsProductSearchOpen(false)}
          onSelect={async (product) => {
            setIsProductSearchOpen(false);
            await handleAddItem(product.name, product.category);
          }}
        />
      </Modal>
    </AppShell>
  );
}
