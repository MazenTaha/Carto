// Redesigned Active Shopping Session page following Screen 6

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { useSessionStore } from '@/store/session-store';
import { calculateProgress } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { ListItem } from '@/types';
import { VirtualReceipt } from '@/components/receipt/VirtualReceipt';

function SessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  
  const { session, receipt, progress, isConnected, setSession, setReceipt, updateProgress, setConnected } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (err) {} finally { setIsLoading(false); }
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
    } catch (err) {} finally { setIsLoading(false); }
  }, [setSession, setReceipt, setConnected, updateProgress]);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      const interval = setInterval(fetchSession, 3000);
      return () => clearInterval(interval);
    } else {
      fetchActiveSession();
      const interval = setInterval(fetchActiveSession, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId, fetchSession, fetchActiveSession]);

  const handleFinishShopping = async () => {
    if (!session) return;
    try {
      const response = await fetch(`/api/sessions/${session.id}/finish`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        router.push(`/checkout?sessionId=${session.id}`);
      }
    } catch (err) {}
  };

  if (isLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase text-sm">Loading session...</p>
        </div>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer className="flex items-center justify-center p-8">
        <div className="text-center max-w-md w-full">
          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-4xl text-slate-400">shopping_basket</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">No active session</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">You don&apos;t have an active shopping session. Connect to a cart to start!</p>
          <button onClick={() => router.push('/lists')} className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20">
            START SHOPPING
          </button>
        </div>
      </PageContainer>
    );
  }

  const progressData = calculateProgress(progress.total, progress.collected);
  const remainingItems: ListItem[] = session.shoppingList?.items?.filter((i: ListItem) => !i.isCollected) || [];
  const collectedItems: ListItem[] = session.shoppingList?.items?.filter((i: ListItem) => i.isCollected) || [];

  return (
    <PageContainer className="bg-white dark:bg-slate-950">
      <Header
        title="Current Session"
        showBack={true}
        onBack={() => router.push('/dashboard')}
        rightElement={
          <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-40">
        <div className="flex flex-col gap-3 p-5 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Progress</p>
              <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-none">
                {progress.collected}/{progress.total} <span className="text-slate-400 font-normal text-lg">items</span>
              </p>
            </div>
            <p className="text-primary font-bold text-xl">{progressData.percentage}%</p>
          </div>
          <div className="w-full bg-primary/10 dark:bg-primary/5 rounded-full h-3 overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${progressData.percentage}%` }}></div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-slate-500 dark:text-slate-400 text-xs">Started 12 mins ago</p>
            <button className="text-primary text-sm font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              Virtual Receipt
            </button>
          </div>
        </div>

        <section className="mt-4 px-4">
          <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500"></span>
            Remaining Items ({remainingItems.length})
          </h3>
          <div className="space-y-3">
            {remainingItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex size-6 items-center justify-center shrink-0">
                  <input
                    className="h-6 w-6 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                    type="checkbox"
                    readOnly
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <p className="text-slate-900 dark:text-slate-100 text-base font-semibold leading-snug">{item.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-xs">location_on</span> {item.category || 'General'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-bold">${(item.price || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 px-4">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest mb-3">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              Collected Items ({collectedItems.length})
            </span>
            <span className="material-symbols-outlined text-lg">expand_more</span>
          </div>
          <div className="space-y-2 opacity-60">
            {collectedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex size-6 items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-medium line-through">
                    {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                  </p>
                </div>
                <p className="text-slate-500 text-xs font-bold">${((item.price || 0) * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>

        {receipt && (
          <div className="px-4 pb-12">
            <VirtualReceipt receipt={receipt} sessionId={session.id} />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
        <div className="flex justify-between items-center mb-1">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Est. Total</span>
          <span className="text-slate-900 dark:text-slate-100 text-2xl font-black">
            {formatCurrency(receipt?.total || 0)}
          </span>
        </div>
        <button
          onClick={handleFinishShopping}
          className="w-full h-16 bg-primary text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">shopping_cart_checkout</span>
          Finish Shopping
        </button>
      </div>
    </PageContainer>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase text-sm">Loading session...</p>
        </div>
      </PageContainer>
    }>
      <SessionContent />
    </Suspense>
  );
}
