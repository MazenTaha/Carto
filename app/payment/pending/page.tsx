'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const LAST_PAYMENT_ATTEMPT_KEY = 'carto_last_payment_attempt';

type AttemptStatusResponse = {
  id: string;
  sessionId: string;
  receiptId: string;
  status: string;
  paymentStatus: string;
  receiptStatus: string;
  lastError: string | null;
};

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

async function fetchAttemptById(attemptId: string) {
  const response = await fetch(`/api/payments/attempts/${encodeURIComponent(attemptId)}`, {
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
    ? `/api/payments/attempts/latest?sessionId=${encodeURIComponent(sessionId)}`
    : '/api/payments/attempts/latest';
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
      params.set('attemptId', attempt.id);
      params.set('sessionId', attempt.sessionId);
      params.set('receiptId', attempt.receiptId);

      if (attempt.status === 'SUCCEEDED' || attempt.receiptStatus === 'PAID' || attempt.paymentStatus === 'COMPLETED') {
        router.replace(`/payment/success?${params.toString()}`);
        return true;
      }

      if (attempt.status === 'FAILED' || attempt.paymentStatus === 'FAILED') {
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

        setAttemptId(resolvedAttempt.id);
        window.localStorage.setItem(LAST_PAYMENT_ATTEMPT_KEY, resolvedAttempt.id);

        if (routeFromStatus(resolvedAttempt)) {
          return;
        }

        setMessage(
          resolvedAttempt.status === 'PROCESSING'
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

  return (
    <PageContainer maxWidth="md">
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <Badge className="bg-primary/10 text-primary ring-primary/10">Payment status</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">Waiting for Paymob confirmation</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {message}
          </p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Current state</p>
            <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">
              {isChecking ? 'Checking with Paymob...' : 'Still waiting on the final gateway result'}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => window.location.reload()} disabled={isChecking}>
              Refresh status
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              Back to dashboard
            </Link>
            <Link
              href="/history"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:col-span-2"
            >
              Check receipt history
            </Link>
          </div>
        </section>
      </main>
    </PageContainer>
  );
}
