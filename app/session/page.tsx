'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CircleAlert, ClipboardList, ReceiptText, ShoppingCart, Unlink } from 'lucide-react';
import { AppShell, MobileActionBar } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ReceiptDivider, ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { useSessionStore } from '@/store/session-store';
import { cn, formatCurrency } from '@/lib/utils';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';

type SessionFetchResult = 'live' | 'stopped' | 'missing' | 'error';

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function SessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const session = useSessionStore((state) => state.session);
  const receipt = useSessionStore((state) => state.receipt);
  const isConnected = useSessionStore((state) => state.isConnected);
  const setSession = useSessionStore((state) => state.setSession);
  const setReceipt = useSessionStore((state) => state.setReceipt);
  const updateProgress = useSessionStore((state) => state.updateProgress);
  const setConnected = useSessionStore((state) => state.setConnected);
  const resetSessionStore = useSessionStore((state) => state.reset);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const sessionRequestInFlightRef = useRef(false);
  const activeRequestInFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Re-arm on every mount: React Strict Mode unmounts and remounts once in development.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchSession = useCallback(async (): Promise<SessionFetchResult> => {
    if (!sessionId || sessionRequestInFlightRef.current) return 'missing';
    sessionRequestInFlightRef.current = true;

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        const message = getApiErrorMessage(data, 'Could not load this cart session.');
        if (isMountedRef.current) {
          setError(message);
          setConnected(false);
          if (response.status === 404) {
            setSession(null);
            setReceipt(null);
            updateProgress(0, 0);
          }
        }
        return response.status === 404 ? 'missing' : 'error';
      }

      if (data.success && isMountedRef.current) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        setError('');
        if (data.data.session.shoppingList?.items) {
          const items = data.data.session.shoppingList.items;
          updateProgress(items.length, items.filter((item: any) => item.isCollected).length);
        }
        return isActiveCartSessionStatus(data.data.session.status) ? 'live' : 'stopped';
      }

      return 'missing';
    } catch {
      if (isMountedRef.current) {
        setError('Could not reach the backend. Check your connection and try again.');
      }
      return 'error';
    } finally {
      sessionRequestInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sessionId, setSession, setReceipt, setConnected, updateProgress]);

  const fetchActiveSession = useCallback(async (): Promise<SessionFetchResult> => {
    if (activeRequestInFlightRef.current) return 'missing';
    activeRequestInFlightRef.current = true;

    try {
      const response = await fetch('/api/sessions/active', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        if (isMountedRef.current) {
          setError(getApiErrorMessage(data, 'Could not load your active session.'));
          setConnected(false);
        }
        return 'error';
      }

      if (!data?.data?.active) {
        if (isMountedRef.current) {
          setSession(null);
          setReceipt(null);
          setConnected(false);
          updateProgress(0, 0);
          setError('');
        }
        return 'missing';
      }

      if (data.success && data.data?.active && data.data.session && isMountedRef.current) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        setError('');
        if (data.data.session.shoppingList?.items) {
          const items = data.data.session.shoppingList.items;
          updateProgress(items.length, items.filter((item: any) => item.isCollected).length);
        }
        return isActiveCartSessionStatus(data.data.session.status) ? 'live' : 'stopped';
      }

      return 'missing';
    } catch {
      if (isMountedRef.current) {
        setError('Could not reach the backend. Check your connection and try again.');
      }
      return 'error';
    } finally {
      activeRequestInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [setSession, setReceipt, setConnected, updateProgress]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const fetchCurrentSession = sessionId ? fetchSession : fetchActiveSession;

    const startPollingIfLive = async () => {
      const result = await fetchCurrentSession();
      if (cancelled || result !== 'live') return;

      interval = setInterval(async () => {
        const nextResult = await fetchCurrentSession();
        if (nextResult !== 'live' && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 3000);
    };

    void startPollingIfLive();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [sessionId, fetchSession, fetchActiveSession]);

  useEffect(() => {
    const refreshCurrentSession = () => {
      if (sessionId) {
        void fetchSession();
        return;
      }

      void fetchActiveSession();
    };

    const handleWindowFocus = () => {
      refreshCurrentSession();
    };

    const handlePageShow = () => {
      refreshCurrentSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentSession();
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
  }, [fetchActiveSession, fetchSession, sessionId]);

  const handleFinishShopping = async () => {
    if (!session || isFinishing || !isActiveCartSessionStatus(session.status)) return;
    setIsFinishing(true);
    setError('');

    try {
      router.push(`/session/ready?sessionId=${session.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleDisconnectCart = async () => {
    if (!session || isDisconnecting || !isSessionLive) {
      return;
    }

    setIsDisconnecting(true);
    setError('');

    try {
      const response = await fetch('/api/cart/current-session/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not disconnect this cart.'));
      }

      resetSessionStore();
      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
      setIsDisconnectConfirmOpen(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Shopping session">
        <LoadingState label="Loading your cart session…" />
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell title="Shopping session" maxWidth="md">
        <EmptyState
          icon={error ? CircleAlert : ShoppingCart}
          tone={error ? 'danger' : 'neutral'}
          title={error ? 'Session unavailable' : 'No active cart session'}
          description={error || 'Pick a shopping list, then scan the QR code on a cart to start a live session.'}
          actionLabel="Choose a list"
          actionHref="/lists?activate=1"
        />
      </AppShell>
    );
  }

  const isSessionLive = isActiveCartSessionStatus(session.status);
  const listItems = session.shoppingList?.items ?? [];
  const receiptItems = receipt?.items ?? [];
  const collectedCount = listItems.filter((item) => item.isCollected).length;
  const progressValue = listItems.length > 0 ? (collectedCount / listItems.length) * 100 : 0;
  const totalLabel = formatCurrency(receipt?.total || 0);
  const actionsDisabled = isDisconnecting || isFinishing || !isSessionLive;

  const finishButton = (
    <Button size="lg" onClick={handleFinishShopping} disabled={actionsDisabled} loading={isFinishing}>
      {!isFinishing && <ShoppingCart aria-hidden="true" />}
      {isFinishing ? 'Preparing checkout…' : 'Finish shopping'}
    </Button>
  );

  return (
    <AppShell title={session.shoppingList?.name || 'Shopping session'} back="/dashboard" bottomBar>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Badge tone={isSessionLive ? (isConnected ? 'success' : 'warning') : 'neutral'} pulse={isSessionLive && isConnected} dot>
            {isSessionLive ? (isConnected ? 'Live on cart' : 'Syncing…') : 'Session ended'}
          </Badge>
          <h1 className="mt-3 break-words text-[1.75rem] font-bold leading-tight sm:text-[2rem]">
            {session.shoppingList?.name || 'Shopping in progress'}
          </h1>
          {session.cart && (
            <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
              Cart <span className="font-mono font-medium text-ink">{session.cart.cartCode}</span>
              {' · '}
              {session.cart.store?.name || 'Carto Store'}
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert tone="danger" className="mt-5">
          {error}
        </Alert>
      )}

      {!isSessionLive && (
        <Alert tone="warning" className="mt-5" title="Live updates stopped">
          This session is {session.status.toLowerCase().replace('_', ' ')}. Start a new session from your lists.
        </Alert>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-6">
          <section aria-labelledby="progress-heading" className="surface-card p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="progress-heading" className="text-base font-semibold">
                  Shopping progress
                </h2>
                <p className="tabular mt-0.5 text-sm text-ink-muted">
                  {collectedCount} of {listItems.length} item{listItems.length === 1 ? '' : 's'} collected
                </p>
              </div>
              <p className="tabular font-display text-2xl font-semibold text-ink">{Math.round(progressValue)}%</p>
            </div>
            <ProgressBar value={progressValue} showValue={false} className="mt-4" tone={progressValue >= 100 ? 'success' : 'brand'} />
          </section>

          <section aria-labelledby="list-heading">
            <h2 id="list-heading" className="mb-3 text-base font-semibold">
              Your list
            </h2>
            {listItems.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No items on this list" />
            ) : (
              <ul className="surface-card divide-y divide-line overflow-hidden">
                {listItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full',
                        item.isCollected ? 'bg-emerald-500 text-white' : 'border-[1.5px] border-line-strong'
                      )}
                    >
                      {item.isCollected && <Check className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className="sr-only">{item.isCollected ? 'Collected:' : 'Not collected yet:'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[0.9375rem] font-medium', item.isCollected ? 'text-ink-subtle line-through' : 'text-ink')}>
                        {item.name}
                      </p>
                      <p className="text-xs text-ink-subtle">{item.category || 'General'}</p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium text-ink-muted">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <ReceiptPanel>
            <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
              <div>
                <h2 className="text-base font-semibold">Live receipt</h2>
                <p className="text-sm text-ink-subtle">Updates as the cart scans items</p>
              </div>
              <ReceiptText className="size-5 text-ink-subtle" aria-hidden="true" />
            </div>
            <ReceiptDivider />
            {receiptItems.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-ink-subtle">No items scanned yet.</p>
            ) : (
              <ul className="max-h-72 space-y-2.5 overflow-y-auto px-5 py-4 custom-scrollbar">
                {receiptItems.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      <span className="tabular text-ink-subtle">{item.quantity}× </span>
                      {item.name}
                    </span>
                    <span className="tabular shrink-0 font-medium text-ink">{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <ReceiptDivider />
            <div className="space-y-2 px-5 py-4 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span className="tabular">{formatCurrency(receipt?.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Tax</span>
                <span className="tabular">{formatCurrency(receipt?.tax || 0)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-semibold text-ink">Total</span>
                <span className="tabular font-display text-2xl font-semibold text-ink">{totalLabel}</span>
              </div>
            </div>
            <div className="hidden gap-2 px-5 pb-5 lg:grid">{finishButton}</div>
          </ReceiptPanel>

          <Button
            variant="danger-soft"
            fullWidth
            onClick={() => setIsDisconnectConfirmOpen(true)}
            disabled={actionsDisabled}
          >
            <Unlink aria-hidden="true" />
            Disconnect cart
          </Button>
        </aside>
      </div>

      <MobileActionBar aboveNav>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-subtle">Current total</p>
            <p className="tabular truncate font-display text-lg font-semibold text-ink">{totalLabel}</p>
          </div>
          {finishButton}
        </div>
      </MobileActionBar>

      <Modal
        open={isDisconnectConfirmOpen}
        onClose={() => setIsDisconnectConfirmOpen(false)}
        dismissible={!isDisconnecting}
        size="sm"
        title="Disconnect this cart?"
        description="Your list will be removed from the cart display and this session will end. You can start a new session any time."
        footer={
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <Button variant="outline" onClick={() => setIsDisconnectConfirmOpen(false)} disabled={isDisconnecting}>
              Keep shopping
            </Button>
            <Button variant="danger" onClick={handleDisconnectCart} loading={isDisconnecting}>
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        }
      />
    </AppShell>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Shopping session">
          <LoadingState label="Loading your cart session…" />
        </AppShell>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
