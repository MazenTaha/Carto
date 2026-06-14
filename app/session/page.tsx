'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSessionStore } from '@/store/session-store';
import { formatCurrency } from '@/lib/utils';
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
  const [error, setError] = useState('');
  const sessionRequestInFlightRef = useRef(false);
  const activeRequestInFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
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
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Loading session" />
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer>
        <main className="flex min-h-screen items-center justify-center p-4">
          <EmptyState
            icon="shopping_basket"
            title={error ? 'Session unavailable' : 'No active session'}
            description={error || 'Select a shopping list first, then scan the QR code on a cart to start a live session.'}
            actionLabel="Select a list"
            actionHref="/lists?activate=1"
            className="max-w-md"
          />
        </main>
      </PageContainer>
    );
  }

  const isSessionLive = isActiveCartSessionStatus(session.status);

  return (
    <PageContainer maxWidth="lg">
      <Header
        title="Active Session"
        showBack
        onBack={() => router.push('/dashboard')}
        rightElement={
          <Badge variant={isSessionLive && isConnected ? 'connected' : 'warning'}>
            <span className="size-1.5 rounded-full bg-current" />
            {isSessionLive ? (isConnected ? 'Linked' : 'Syncing') : 'Ended'}
          </Badge>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-44 pt-6 md:pb-10">
        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </section>
        )}

        {!isSessionLive && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            This session is {session.status.toLowerCase().replace('_', ' ')}. Live polling has stopped.
          </section>
        )}

        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge className="bg-white/10 text-white ring-white/15">Cart session</Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight">{session.shoppingList?.name || 'Shopping in progress'}</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Your cart is connected and ready. Finish shopping whenever you want to move into the payment step.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Estimated total</p>
              <p className="text-2xl font-black">{formatCurrency(receipt?.total || 0)}</p>
            </div>
          </div>
        </section>

        {session.cart && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Linked physical cart</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-slate-100">{session.cart.cartCode}</h2>
              </div>
              <Badge variant={session.cart.status === 'IN_USE' ? 'connected' : 'warning'}>
                {session.cart.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-bold text-slate-500">Device name</p>
                <p className="mt-1 truncate font-black text-slate-900 dark:text-slate-100">
                  {session.cart.bluetoothName || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-500">Store</p>
                <p className="mt-1 truncate font-black text-slate-900 dark:text-slate-100">
                  {session.cart.store?.name || 'Carto Store'}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 shadow-[0_-14px_30px_rgba(114,47,55,0.12)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">Estimated total</span>
            <span className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(receipt?.total || 0)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              onClick={handleDisconnectCart}
              disabled={isDisconnecting || isFinishing || !isSessionLive}
            >
              <span className="material-symbols-outlined">link_off</span>
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect cart'}
            </Button>
            <Button size="lg" className="w-full" onClick={handleFinishShopping} disabled={isFinishing || isDisconnecting || !isSessionLive}>
              <span className="material-symbols-outlined">shopping_cart_checkout</span>
              {isFinishing ? 'Preparing checkout...' : 'Finish Shopping'}
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden lg:fixed lg:bottom-6 lg:right-6 lg:z-40 lg:flex lg:items-center lg:gap-3">
        <Button
          size="lg"
          variant="outline"
          className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
          onClick={handleDisconnectCart}
          disabled={isDisconnecting || isFinishing || !isSessionLive}
        >
          <span className="material-symbols-outlined">link_off</span>
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect cart'}
        </Button>
        <Button size="lg" onClick={handleFinishShopping} disabled={isFinishing || isDisconnecting || !isSessionLive}>
          <span className="material-symbols-outlined">shopping_cart_checkout</span>
          {isFinishing ? 'Preparing checkout...' : 'Finish Shopping'}
        </Button>
      </div>
    </PageContainer>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <LoadingState label="Loading session" />
        </PageContainer>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
