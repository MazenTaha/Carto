'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Hourglass, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';

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
    <StatusScreen
      icon={isChecking ? Loader2 : Hourglass}
      iconClassName={isChecking ? 'animate-spin' : undefined}
      tone="brand"
      eyebrow={<Badge tone="warning" dot pulse>Verifying payment</Badge>}
      title="Confirming your payment"
      description={message}
      actions={
        <>
          <ButtonLink href={sessionHref} size="lg">
            Back to my session
          </ButtonLink>
          <Button size="lg" variant="outline" onClick={() => window.location.reload()} disabled={isChecking || isDisconnecting}>
            <RefreshCw aria-hidden="true" />
            {isChecking ? 'Checking…' : 'Refresh status'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-center text-sm text-ink-muted" aria-live="polite">
          {isChecking ? 'Checking with Paymob…' : 'We check again every few seconds. You can keep this page open.'}
        </p>
        <Alert tone="info" title="Your cart session is still active">
          Only a verified Paymob confirmation marks the receipt as paid and checks out the cart.
        </Alert>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-line pt-4 sm:flex-row">
          <ButtonLink href="/history" variant="ghost" size="sm">
            <History aria-hidden="true" />
            Receipt history
          </ButtonLink>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => void handleDisconnect()}
            disabled={!sessionId}
            loading={isDisconnecting}
          >
            {!isDisconnecting && <Unlink aria-hidden="true" />}
            {isDisconnecting ? 'Disconnecting cart…' : 'Disconnect cart'}
          </Button>
        </div>
      </div>
    </StatusScreen>
  );
}
