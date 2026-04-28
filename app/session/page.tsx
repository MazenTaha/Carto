'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { VirtualReceipt } from '@/components/receipt/VirtualReceipt';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useSessionStore } from '@/store/session-store';
import { calculateProgress, formatCurrency } from '@/lib/utils';
import { ListItem } from '@/types';

function SessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const { session, receipt, progress, isConnected, setSession, setReceipt, updateProgress, setConnected } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        if (data.data.session.shoppingList?.items) {
          const items: ListItem[] = data.data.session.shoppingList.items;
          updateProgress(items.length, items.filter((item) => item.isCollected).length);
        }
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, setSession, setReceipt, setConnected, updateProgress]);

  const fetchActiveSession = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions/active');
      const data = await response.json();
      if (data.success && data.data) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        if (data.data.session.shoppingList?.items) {
          const items = data.data.session.shoppingList.items;
          updateProgress(items.length, items.filter((item: any) => item.isCollected).length);
        }
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  }, [setSession, setReceipt, setConnected, updateProgress]);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      const interval = setInterval(fetchSession, 3000);
      return () => clearInterval(interval);
    }

    fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 3000);
    return () => clearInterval(interval);
  }, [sessionId, fetchSession, fetchActiveSession]);

  const handleFinishShopping = async () => {
    if (!session) return;
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/sessions/${session.id}/finish`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        router.push(`/checkout?sessionId=${session.id}`);
      }
    } catch (err) {
      setIsFinishing(false);
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
            title="No active session"
            description="Select a shopping list first, then scan the QR code on a cart to start a live session."
            actionLabel="Select a list"
            actionHref="/lists?activate=1"
            className="max-w-md"
          />
        </main>
      </PageContainer>
    );
  }

  const progressData = calculateProgress(progress.total, progress.collected);
  const remainingItems: ListItem[] = session.shoppingList?.items?.filter((item: ListItem) => !item.isCollected) || [];
  const collectedItems: ListItem[] = session.shoppingList?.items?.filter((item: ListItem) => item.isCollected) || [];

  return (
    <PageContainer maxWidth="lg">
      <Header
        title="Active Session"
        showBack
        onBack={() => router.push('/dashboard')}
        rightElement={
          <Badge variant={isConnected ? 'success' : 'warning'}>
            <span className="size-1.5 rounded-full bg-current" />
            {isConnected ? 'Linked' : 'Syncing'}
          </Badge>
        }
      />

      <main className="grid flex-1 gap-6 pb-44 pt-6 lg:grid-cols-[1fr_380px] md:pb-10">
        <div className="space-y-6">
          <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="bg-white/10 text-white ring-white/15">Cart session</Badge>
                <h1 className="mt-4 text-3xl font-black tracking-tight">{session.shoppingList?.name || 'Shopping in progress'}</h1>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  The cart is using your active list. Progress updates as items are collected or scanned.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Estimated total</p>
                <p className="text-2xl font-black">{formatCurrency(receipt?.total || 0)}</p>
              </div>
            </div>
            <ProgressBar value={progressData.percentage} label={`${progress.collected}/${progress.total} items collected`} className="mt-6" />
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Remaining</p>
              <p className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-100">{remainingItems.length}</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-4 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Collected</p>
              <p className="mt-2 text-3xl font-black text-primary">{collectedItems.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cart status</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{isConnected ? 'Connected' : 'Waiting'}</p>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                Remaining Items ({remainingItems.length})
              </h2>
              <Badge variant="warning">On cart</Badge>
            </div>
            <div className="space-y-3">
              {remainingItems.length > 0 ? (
                remainingItems.map((item) => (
                  <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                      <span className="material-symbols-outlined">pending</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950 dark:text-slate-100">{item.name}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{item.category || 'General'} · Qty {item.quantity}</p>
                    </div>
                    <p className="font-black text-slate-950 dark:text-slate-100">{formatCurrency((item.price || 0) * item.quantity)}</p>
                  </article>
                ))
              ) : (
                <EmptyState icon="task_alt" title="Everything is collected" description="You are ready to finish shopping and review checkout." />
              )}
            </div>
          </section>

          {collectedItems.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                  Collected Items ({collectedItems.length})
                </h2>
                <Badge variant="success">Done</Badge>
              </div>
              <div className="space-y-2">
                {collectedItems.map((item) => (
                  <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 opacity-75 dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-600 line-through dark:text-slate-300">
                      {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                    </p>
                    <p className="text-xs font-bold text-slate-500">{formatCurrency((item.price || 0) * item.quantity)}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {receipt && <VirtualReceipt receipt={receipt} sessionId={session.id} />}
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 shadow-[0_-14px_30px_rgba(15,23,42,0.1)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">Estimated total</span>
            <span className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(receipt?.total || 0)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={handleFinishShopping} disabled={isFinishing}>
            <span className="material-symbols-outlined">shopping_cart_checkout</span>
            {isFinishing ? 'Preparing checkout...' : 'Finish Shopping'}
          </Button>
        </div>
      </div>

      <div className="hidden lg:fixed lg:bottom-6 lg:right-6 lg:z-40 lg:block">
        <Button size="lg" onClick={handleFinishShopping} disabled={isFinishing}>
          <span className="material-symbols-outlined">shopping_cart_checkout</span>
          {isFinishing ? 'Preparing checkout...' : 'Finish Shopping'}
        </Button>
      </div>

    </PageContainer>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <LoadingState label="Loading session" />
      </PageContainer>
    }>
      <SessionContent />
    </Suspense>
  );
}
