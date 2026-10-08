'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, ReceiptText, ShieldCheck, Unlink } from 'lucide-react';
import { AppShell, MobileActionBar } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReceiptDivider, ReceiptPanel } from '@/components/ui/ReceiptPanel';
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
        label: 'Ready to pay',
        description: 'Awaiting payment',
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
      <AppShell variant="focus" title="Checkout" back={sessionHref} maxWidth="md">
        <LoadingState label="Preparing checkout…" />
      </AppShell>
    );
  }

  if (!receipt) {
    return (
      <AppShell variant="focus" title="Checkout" back={sessionHref} maxWidth="md">
        <EmptyState
          icon={ReceiptText}
          title="Checkout is not ready"
          description={error || 'Finish an active shopping session before opening checkout.'}
          actionLabel="Back to home"
          actionHref="/dashboard"
        />
      </AppShell>
    );
  }

  const payButton = (
    <Button size="lg" fullWidth onClick={handlePayment} loading={isProcessing} disabled={isDisconnecting}>
      {!isProcessing && <Lock aria-hidden="true" />}
      {isProcessing ? 'Opening Paymob…' : `Pay ${demoAmountLabel}`}
    </Button>
  );

  return (
    <AppShell variant="focus" title="Checkout" back={sessionHref} maxWidth="md" bottomBar>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Secure checkout
            </Badge>
            <Badge tone="warning">Paymob test mode</Badge>
          </div>
        }
        title="Review and pay"
        description="You will finish on Paymob's hosted page. Card and wallet details never touch Carto."
      />

      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}

      <ReceiptPanel className="mt-6">
        <div className="px-5 pb-5 pt-6 text-center sm:px-8 sm:pt-8">
          <p className="text-sm font-medium text-ink-muted">Amount to pay</p>
          <p className="tabular mt-1 font-display text-5xl font-bold tracking-tight text-ink">{demoAmountLabel}</p>
          <div className="mt-3 flex justify-center">
            <Badge tone={receipt.paymentStatus === 'FAILED' ? 'danger' : receipt.paymentStatus === 'COMPLETED' ? 'success' : 'neutral'} dot>
              {paymentStatusCopy.label} · {paymentStatusCopy.description}
            </Badge>
          </div>
        </div>
        <ReceiptDivider />
        <DescriptionList
          className="px-5 py-4 sm:px-8"
          items={[
            { label: 'Receipt', value: `#${receiptReference}`, mono: true },
            { label: 'Payment provider', value: 'Paymob' },
            { label: 'Currency', value: DEMO_PAYMENT_CURRENCY },
          ]}
        />
        <div className="hidden px-5 pb-6 sm:px-8 lg:block">{payButton}</div>
      </ReceiptPanel>

      <Alert tone="info" className="mt-4" title="Your cart session stays active">
        Opening checkout does not end your session. Your receipt is marked paid only after Paymob confirms the payment.
      </Alert>

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => router.push(sessionHref)} disabled={isProcessing || isDisconnecting}>
          <ArrowLeft aria-hidden="true" />
          Back to my session
        </Button>
        <Button
          variant="danger-soft"
          onClick={() => void handleDisconnect()}
          loading={isDisconnecting}
          disabled={isProcessing}
        >
          {!isDisconnecting && <Unlink aria-hidden="true" />}
          {isDisconnecting ? 'Disconnecting cart…' : 'Disconnect cart'}
        </Button>
      </div>

      <MobileActionBar>{payButton}</MobileActionBar>
    </AppShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <AppShell variant="focus" title="Checkout" back="/dashboard" maxWidth="md">
          <LoadingState label="Loading checkout…" />
        </AppShell>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
