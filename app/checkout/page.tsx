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
import { DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY } from '@/lib/constants/demo-payment';
import { formatPaymentCurrency } from '@/lib/payment-money';

const LAST_PAYMENT_ATTEMPT_KEY = 'carto_last_payment_attempt';

function getApiErrorMessage(data: any, fallback: string) {
  if (typeof data?.message === 'string') return data.message;
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function getApiErrorDebug(data: any) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const error = data.error && typeof data.error === 'object' ? data.error : null;

  return {
    code: error && typeof error.code === 'string' ? error.code : null,
    message: getApiErrorMessage(data, 'Unknown error'),
    missing: error && Array.isArray(error.missing)
      ? error.missing.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
    provider: error && typeof error.provider === 'string' ? error.provider : null,
    providerMessage: error && typeof error.providerMessage === 'string' ? error.providerMessage : null,
  };
}

function getCheckoutStatusCopy(paymentStatus: string | null | undefined) {
  switch ((paymentStatus || '').toUpperCase()) {
    case 'COMPLETED':
      return {
        label: 'Confirmed',
        description: 'Payment confirmed',
      };
    case 'PROCESSING':
      return {
        label: 'Processing',
        description: 'Waiting for final confirmation',
      };
    case 'FAILED':
      return {
        label: 'Payment failed',
        description: 'Try starting checkout again',
      };
    default:
      return {
        label: 'Pending confirmation',
        description: 'Confirmed only after webhook verification',
      };
  }
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
  const demoAmountLabel = formatPaymentCurrency(DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY);
  const receiptReference = receipt?.id.slice(-6).toUpperCase() || '------';
  const paymentStatusCopy = getCheckoutStatusCopy(receipt?.paymentStatus);

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
        console.error('Checkout page failed to initialize hosted checkout.', {
          status: response.status,
          sessionId,
          receiptId: receipt.id,
          error: getApiErrorDebug(data),
        });
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
      console.error('Checkout page encountered an unexpected payment initialization error.', {
        sessionId,
        receiptId: receipt?.id || null,
        message: err?.message || 'Unknown error',
      });
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

      <main className="grid flex-1 gap-6 pb-44 pt-6 lg:grid-cols-[minmax(0,1fr)_390px] md:pb-12">
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

          <section className="rounded-[2rem] border border-primary/10 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Payment summary</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Pay securely with Paymob</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  You will be redirected to Paymob&apos;s hosted checkout to complete this payment securely. Carto only receives payment confirmation after verification.
                </p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined">lock</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-primary/10 bg-[#fffaf8] p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Amount to pay</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{demoAmountLabel}</p>
                <p className="mt-2 text-sm text-slate-500">One secure demo payment through Paymob hosted checkout.</p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment status</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">{paymentStatusCopy.label}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{paymentStatusCopy.description}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-primary/10 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Receipt number</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">#{receiptReference}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment method</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">Paymob hosted checkout</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                Your card and wallet details are handled by Paymob. Carto keeps your receipt pending until the payment webhook is verified.
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">What happens next</p>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">A clean handoff to secure payment</h3>
            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">1</span>
                <div>
                  <p className="font-black text-slate-950 dark:text-slate-100">Continue to Paymob</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Tap the checkout button and Carto will open Paymob&apos;s hosted payment page.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">2</span>
                <div>
                  <p className="font-black text-slate-950 dark:text-slate-100">Paymob handles the secure step</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Your card or wallet details stay inside Paymob&apos;s checkout experience, not inside Carto.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">3</span>
                <div>
                  <p className="font-black text-slate-950 dark:text-slate-100">Carto confirms payment after verification</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Your receipt is marked paid only after the backend verifies Paymob&apos;s final webhook callback.</p>
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
              <Badge className="bg-primary/10 text-primary ring-primary/10">Receipt summary</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-slate-100">Carto checkout</h2>
              <p className="mt-1 text-sm text-slate-500">Receipt #{receiptReference}</p>
            </div>

            <div className="space-y-4 border-y border-dashed border-slate-200 p-5 dark:border-slate-800 md:p-6">
              <div className="rounded-[1.5rem] border border-primary/10 bg-[#fffaf8] p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Secure Paymob payment</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{demoAmountLabel}</p>
                <p className="mt-2 text-sm text-slate-500">Redirects to Paymob hosted checkout for secure card or wallet payment.</p>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-950/70">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Items</span>
                  <span className="font-bold text-slate-950 dark:text-slate-100">Demo checkout amount</span>
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-bold text-slate-950 dark:text-slate-100">{demoAmountLabel}</span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-950 dark:text-slate-100">Total</span>
                  <span className="text-3xl font-black text-primary">{demoAmountLabel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  No delivery fee or service fee is added to this demo checkout.
                </p>
              </div>
            </div>

            <div className="bg-[#fffaf8] p-5 dark:bg-slate-950/50 md:p-6">
              <div className="rounded-[1.5rem] border border-primary/10 bg-white p-4 shadow-sm dark:bg-slate-950">
                <p className="text-sm font-black text-slate-950 dark:text-slate-100">Ready to continue?</p>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Paymob handles the secure payment screen. Carto only updates your receipt after verification.
                </p>
              </div>

              <Button
                size="lg"
                className="mt-4 h-12 w-full rounded-2xl shadow-sm shadow-primary/20"
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? 'Opening Paymob...' : 'Continue to Paymob Checkout'}
              </Button>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-primary/20 bg-white text-primary hover:border-primary/35 hover:bg-primary/5 dark:border-primary/25 dark:bg-slate-950"
                  onClick={() => router.push(sessionHref)}
                  disabled={isProcessing || isDisconnecting}
                >
                  Back to my session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
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

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur pb-[calc(env(safe-area-inset-bottom)+12px)] dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p className="text-2xl font-black text-slate-950 dark:text-slate-100">{demoAmountLabel}</p>
          </div>
          <Button
            onClick={handlePayment}
            disabled={isProcessing || isDisconnecting}
            className="h-12 shrink-0 rounded-2xl px-5 text-sm font-bold shadow-sm shadow-primary/20"
          >
            {isProcessing ? 'Opening Paymob...' : 'Continue to Paymob'}
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
