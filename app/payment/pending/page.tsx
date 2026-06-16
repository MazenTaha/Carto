'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

const LAST_PAYMENT_ATTEMPT_KEY = 'carto_last_payment_attempt';

type AttemptStatusResponse = {
  paymentStatus: string;
  receiptStatus: string;
  cartSessionStatus: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
};

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

async function fetchAttemptById(attemptId: string) {
  const response = await fetch(`/api/payments/status?attemptId=${encodeURIComponent(attemptId)}`, {
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success || !data?.data) {
    throw new Error(getApiErrorMessage(data, 'Could not check payment status.'));
  }

  return data.data as AttemptStatusResponse;
}

async function fetchLatestAttempt(sessionId: string | null) {
  const url = sessionId
    ? `/api/payments/status?sessionId=${encodeURIComponent(sessionId)}`
    : '/api/payments/status';
  const response = await fetch(url, {
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success === false) {
    throw new Error(getApiErrorMessage(data, 'Could not check payment status.'));
  }

  return (data?.data || null) as AttemptStatusResponse | null;
}

export default function PaymentPendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const queryAttemptId = searchParams.get('attemptId');

  const [attemptId, setAttemptId] = useState<string | null>(queryAttemptId);
  const [isChecking, setIsChecking] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState('Checking the latest payment update from Paymob...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (queryAttemptId) {
      window.localStorage.setItem(LAST_PAYMENT_ATTEMPT_KEY, queryAttemptId);
      setAttemptId(queryAttemptId);
      return;
    }

    const storedAttemptId = window.localStorage.getItem(LAST_PAYMENT_ATTEMPT_KEY);
    if (storedAttemptId) {
      setAttemptId(storedAttemptId);
    }
  }, [queryAttemptId]);

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    const routeFromStatus = (attempt: AttemptStatusResponse) => {
      const params = new URLSearchParams();
      if (attemptId) {
        params.set('attemptId', attemptId);
      }
      if (sessionId) {
        params.set('sessionId', sessionId);
      }

      if (attempt.paymentStatus === 'PAID' || attempt.receiptStatus === 'PAID') {
        router.replace(`/payment/success?${params.toString()}`);
        return true;
      }

      if (attempt.paymentStatus === 'FAILED') {
        router.replace(`/payment/failure?${params.toString()}`);
        return true;
      }

      return false;
    };

    const checkStatus = async () => {
      setIsChecking(true);
      setError('');

      try {
        const resolvedAttempt = attemptId
          ? await fetchAttemptById(attemptId)
          : await fetchLatestAttempt(sessionId);

        if (!resolvedAttempt) {
          setMessage('Waiting for a payment attempt to appear. If you just left Paymob, this usually takes a moment.');
          return;
        }

        if (cancelled) return;

        if (routeFromStatus(resolvedAttempt)) {
          return;
        }

        setMessage(
          resolvedAttempt.paymentStatus === 'PROCESSING'
            ? 'Payment is still processing. We will move you forward automatically as soon as Paymob confirms the result.'
            : 'Payment is pending confirmation. Keep this page open while we wait for Paymob.'
        );
      } catch (nextError: any) {
        if (!cancelled) {
          setError(nextError.message || 'Could not check payment status.');
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    void checkStatus();
    interval = window.setInterval(() => {
      void checkStatus();
    }, 3000);

    return () => {
      cancelled = true;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [attemptId, router, sessionId]);

  const sessionHref = sessionId
    ? `/session/ready?sessionId=${encodeURIComponent(sessionId)}`
    : '/dashboard';

  async function handleDisconnect() {
    if (!sessionId || isDisconnecting) return;

    setIsDisconnecting(true);
    setError('');

    try {
      const response = await fetch('/api/cart/current-session/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not disconnect this cart.'));
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (nextError: any) {
      setError(nextError.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
    }
  }

  return (
    <PageContainer maxWidth="md">
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <Link href="/dashboard" aria-label="Go to Carto home" className="mx-auto mb-8 flex w-fit justify-center">
            <Logo width={128} height={46} />
          </Link>

          <Badge className="bg-primary/10 text-primary ring-primary/10">Secure Checkout</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">Payment is being verified</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {message}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Mode</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">Paymob test mode</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Status</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">
                {isChecking ? 'Checking with Paymob...' : 'Verification pending'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="font-black">Your cart session is still active.</p>
            <p className="mt-2">You can return to your session until payment is completed. Only the verified Paymob webhook can mark the receipt as paid and check out the cart.</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href={sessionHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-[0.98]"
            >
              Back to my session
            </Link>
            <Button onClick={() => window.location.reload()} disabled={isChecking || isDisconnecting} variant="outline">
              {isChecking ? 'Checking status...' : 'Refresh status'}
            </Button>
            <Link
              href="/history"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:col-span-2"
            >
              Check receipt history
            </Link>
            <Button
              type="button"
              variant="outline"
              className="sm:col-span-2 h-12 rounded-2xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              onClick={() => void handleDisconnect()}
              disabled={!sessionId || isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting cart...' : 'Disconnect cart'}
            </Button>
          </div>
        </section>
      </main>
    </PageContainer>
  );
}
