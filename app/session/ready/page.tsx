'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatCurrency } from '@/lib/utils';
import { isActiveCartSessionStatus } from '@/lib/cart-session-status';

type ReadySessionResponse = {
  session: {
    id: string;
    status: string;
    shoppingList: {
      id: string;
      name: string;
      items: Array<{ id: string }>;
    } | null;
    cart: {
      cartCode: string;
    } | null;
  };
  receipt: {
    id: string;
    status: string;
    total: number;
  } | null;
};

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function ReadySessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [sessionData, setSessionData] = useState<ReadySessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState('');

  const fetchSession = useCallback(async (signal?: AbortSignal) => {
    if (!sessionId) {
      setError('Missing session ID.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
        signal,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.data?.session) {
        throw new Error(getApiErrorMessage(data, 'Could not load your cart session.'));
      }

      setSessionData(data.data as ReadySessionResponse);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not load your cart session.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSession(controller.signal);
    return () => controller.abort();
  }, [fetchSession]);

  const handleContinue = useCallback(async () => {
    if (!sessionId || !sessionData || isContinuing) return;

    if (sessionData.receipt?.status === 'PAID') {
      router.replace(`/checkout/success?sessionId=${encodeURIComponent(sessionId)}`);
      return;
    }

    setIsContinuing(true);
    setError('');

    try {
      if (isActiveCartSessionStatus(sessionData.session.status)) {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/finish`, {
          method: 'POST',
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
          throw new Error(getApiErrorMessage(data, 'Could not prepare checkout.'));
        }
      }

      router.replace(`/checkout?sessionId=${encodeURIComponent(sessionId)}`);
    } catch (err: any) {
      setError(err.message || 'Could not prepare checkout.');
      setIsContinuing(false);
    }
  }, [isContinuing, router, sessionData, sessionId]);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Preparing your cart" />
      </PageContainer>
    );
  }

  if (!sessionData) {
    return (
      <PageContainer>
        <main className="flex min-h-screen items-center justify-center p-4">
          <EmptyState
            icon="shopping_basket"
            title="Cart session unavailable"
            description={error || 'We could not find the linked cart session.'}
            actionLabel="Back to home"
            actionHref="/dashboard"
            className="max-w-md"
          />
        </main>
      </PageContainer>
    );
  }

  const listName = sessionData.session.shoppingList?.name || 'Selected list';
  const itemCount = sessionData.session.shoppingList?.items?.length || 0;
  const cartCode = sessionData.session.cart?.cartCode || 'Cart connected';
  const total = sessionData.receipt?.total || 0;
  const sessionIsLive = isActiveCartSessionStatus(sessionData.session.status);

  return (
    <PageContainer maxWidth="md">
      <Header title="Ready for checkout" showBack onBack={() => router.push('/dashboard')} />

      <main className="flex min-h-[calc(100dvh-4.5rem)] flex-col justify-center px-4 pb-32 pt-6 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-soft">
          <div className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%)] p-6 sm:p-8">
            <Badge className="bg-white/10 text-white ring-white/15">Cart connected</Badge>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Your list was sent to {cartCode}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Your smart cart session is ready. Continue when you are ready to lock the receipt and move into payment.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Shopping list</p>
                <p className="mt-2 text-lg font-black">{listName}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Items</p>
                <p className="mt-2 text-lg font-black">
                  {itemCount} item{itemCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Current total</p>
                <p className="mt-2 text-lg font-black">{formatCurrency(total)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">shopping_cart_checkout</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Next step: payment</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                We removed the old live tracking cards from this post-scan step. You can go straight to checkout from here.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                {sessionIsLive
                  ? 'Continuing will finalize the active cart session and open checkout.'
                  : 'This session is already finalized, so continuing will open checkout directly.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-md flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] min-[420px]:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-2xl"
            onClick={() => router.push('/dashboard')}
          >
            Back to home
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl"
            onClick={() => void handleContinue()}
            disabled={isContinuing}
          >
            {isContinuing ? 'Preparing checkout...' : 'Continue to payment'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function ReadySessionPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <LoadingState label="Preparing your cart" />
        </PageContainer>
      }
    >
      <ReadySessionContent />
    </Suspense>
  );
}
