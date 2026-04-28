'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { Receipt } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'saved' | 'new'>('saved');

  const fetchReceipt = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      if (data.success && data.data.receipt) {
        setReceipt(data.data.receipt);
      } else {
        setError('Receipt not found');
      }
    } catch (err) {
      setError('Failed to load receipt');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchReceipt();
    } else {
      setIsLoading(false);
      setError('Missing session ID');
    }
  }, [sessionId, fetchReceipt]);

  const handlePayment = async () => {
    if (!receipt || !sessionId) return;
    setIsProcessing(true);
    setError('');
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: receipt.id,
          sessionId,
          amount: receipt.total,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment failed');

      if (data.data.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      } else {
        router.push(`/checkout/success?sessionId=${sessionId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

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
            <Badge className="bg-white/10 text-white ring-white/15">Final step</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Review and pay</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Confirm the virtual receipt from your smart cart session. This demo payment will finalize the transaction and move it to history.
            </p>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Payment Method</h2>
                <p className="mt-1 text-sm text-slate-500">Choose how to complete this demo checkout.</p>
              </div>
              <span className="material-symbols-outlined text-primary">lock</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold transition hover:border-primary/30 hover:bg-white dark:border-slate-800 dark:bg-slate-950" type="button">
                <span className="rounded bg-slate-950 px-1.5 py-1 text-[10px] font-black text-white">Pay</span>
                Apple Pay
              </button>
              <button className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold transition hover:border-primary/30 hover:bg-white dark:border-slate-800 dark:bg-slate-950" type="button">
                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                Google Pay
              </button>
            </div>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">or card</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-3">
              {[
                { id: 'saved' as const, title: 'Visa ending in 4242', helper: 'Expires 12/26', icon: 'credit_card' },
                { id: 'new' as const, title: 'Add new payment method', helper: 'Use another card for this transaction', icon: 'add_card' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition',
                    paymentMethod === method.id
                      ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                      : 'border-slate-200 bg-white hover:border-primary/30 dark:border-slate-800 dark:bg-slate-950'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <span className="material-symbols-outlined">{method.icon}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-950 dark:text-slate-100">{method.title}</span>
                      <span className="text-sm text-slate-500">{method.helper}</span>
                    </span>
                  </span>
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', paymentMethod === method.id ? 'border-primary' : 'border-slate-300')}>
                    {paymentMethod === method.id && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                </button>
              ))}
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
                <span className="font-bold">$0.00</span>
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
                Secure demo checkout
              </div>
              <Button size="lg" className="mt-4 w-full" onClick={handlePayment} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : `Confirm and Pay ${formatCurrency(receipt.total)}`}
              </Button>
            </div>
          </ReceiptPanel>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 shadow-[0_-14px_30px_rgba(15,23,42,0.1)] dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Total</p>
            <p className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(receipt.total)}</p>
          </div>
          <Button onClick={handlePayment} disabled={isProcessing}>
            {isProcessing ? 'Processing' : 'Pay'}
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
