'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Logo } from '@/components/ui/Logo';
import { ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { Receipt } from '@/types';
import { formatCurrency } from '@/lib/utils';

const LAST_PAYMENT_ATTEMPT_KEY = 'carto_last_payment_attempt';

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const fetchReceipt = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        signal,
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success && data.data.receipt) {
        setReceipt(data.data.receipt);
      } else {
        setError(getApiErrorMessage(data, 'Receipt not found'));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Failed to load receipt');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    const controller = new AbortController();

    if (sessionId) {
      void fetchReceipt(controller.signal);
    } else {
      setIsLoading(false);
      setError('Missing session ID');
    }

    return () => controller.abort();
  }, [sessionId, fetchReceipt]);

  const handlePayment = async () => {
    if (!receipt || !sessionId || isProcessing) return;
    setIsProcessing(true);
    setError('');
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: receipt.id,
          sessionId,
          paymentMethod: 'CARD',
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not open Paymob checkout.'));
      }

      if (data.data?.attemptId) {
        window.localStorage.setItem(LAST_PAYMENT_ATTEMPT_KEY, data.data.attemptId);
      }

      if (data.data?.alreadyPaid) {
        const params = new URLSearchParams({ sessionId });
        if (data.data?.receiptId) {
          params.set('receiptId', data.data.receiptId);
        }
        if (data.data?.attemptId) {
          params.set('attemptId', data.data.attemptId);
        }
        router.push(`/payment/success?${params.toString()}`);
        return;
      }

      if (!data.data?.paymentUrl) {
        throw new Error('Paymob checkout URL is missing.');
      }

      window.location.assign(data.data.paymentUrl);
    } catch (err: any) {
      setError(err.message || 'Could not open Paymob checkout.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!sessionId || isDisconnecting) return;

    setIsDisconnecting(true);
    setError('');

    try {
      const response = await fetch('/api/cart/current-session/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not disconnect this cart.'));
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
    }
  };

  const sessionHref = sessionId ? `/session/ready?sessionId=${encodeURIComponent(sessionId)}` : '/dashboard';

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Preparing checkout" />
      </PageContainer>
    );
  }

  if (!receipt) {
    return (
      <PageContainer>
        <main className="flex min-h-screen items-center justify-center p-4">
          <EmptyState
            icon="receipt_long"
            title="Checkout is not ready"
            description={error || 'Finish an active shopping session before opening checkout.'}
            actionLabel="Back to dashboard"
            actionHref="/dashboard"
            className="max-w-md"
          />
        </main>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <Header title="Checkout" showBack />

      <main className="grid flex-1 gap-6 pb-32 pt-6 lg:grid-cols-[1fr_380px] md:pb-10">
        <section className="space-y-6">
          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft md:p-6">
            <Logo width={132} height={48} />
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="bg-white/10 text-white ring-white/15">Secure Checkout</Badge>
              <Badge className="bg-emerald-400/15 text-emerald-100 ring-emerald-300/20">Paymob test mode</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Secure Checkout</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Review your Carto receipt, then continue to the hosted Paymob checkout. Card and wallet details stay on Paymob, and your receipt becomes paid only after verified gateway confirmation.
            </p>
            <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-white/80">
              <p className="font-black text-white">Your cart session is still active</p>
              <p className="mt-2">Going to checkout does not finish your shopping session. You can return to your session until payment is completed.</p>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Hosted Paymob checkout</h2>
                <p className="mt-1 text-sm text-slate-500">You will be redirected to Paymob to complete this payment securely in EGP.</p>
              </div>
              <span className="material-symbols-outlined text-primary">lock</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Order summary</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>Receipt ID: {receipt.id.slice(-6).toUpperCase()}</p>
                  <p>Currency: EGP</p>
                  <p>Payment status: {receipt.paymentStatus || 'PENDING'}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">What happens next</p>
                <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Paymob will handle the card or wallet screen outside the app.</p>
                <p>Your receipt history updates only after the backend receives the final payment confirmation.</p>
                <p>If Paymob returns you before the webhook finishes, Carto will keep checking the payment status automatically.</p>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ReceiptPanel>
            <div className="p-5 md:p-6">
              <Badge variant="success">Receipt summary</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-slate-100">Carto checkout</h2>
              <p className="mt-1 text-sm text-slate-500">Receipt #{receipt.id.slice(-6).toUpperCase()}</p>
            </div>

            <div className="space-y-4 border-y border-dashed border-slate-200 p-5 dark:border-slate-800 md:p-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Shopping session items</span>
                <span className="font-bold">{formatCurrency(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Platform fee</span>
                <span className="font-bold">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Estimated tax</span>
                <span className="font-bold">{formatCurrency(receipt.tax)}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-5 dark:bg-slate-950/50 md:p-6">
              <div className="flex items-end justify-between">
                <span className="text-base font-black text-slate-950 dark:text-slate-100">Total Amount</span>
                <span className="text-3xl font-black text-primary">{formatCurrency(receipt.total)}</span>
              </div>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                <span className="material-symbols-outlined text-sm">encrypted</span>
                Test mode payment through Paymob
              </div>
              <Button size="lg" className="mt-4 w-full" onClick={handlePayment} disabled={isProcessing}>
                {isProcessing ? 'Opening Paymob...' : 'Continue to Paymob Checkout'}
              </Button>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={() => router.push(sessionHref)}
                  disabled={isProcessing || isDisconnecting}
                >
                  Back to my session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                  onClick={() => void handleDisconnect()}
                  disabled={isProcessing || isDisconnecting}
                >
                  {isDisconnecting ? 'Disconnecting cart...' : 'Disconnect cart'}
                </Button>
              </div>
            </div>
          </ReceiptPanel>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 shadow-[0_-14px_30px_rgba(114,47,55,0.12)] dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Total</p>
            <p className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(receipt.total)}</p>
          </div>
          <Button onClick={handlePayment} disabled={isProcessing || isDisconnecting}>
            {isProcessing ? 'Opening' : 'Continue to Paymob'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <LoadingState label="Loading checkout" />
      </PageContainer>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
