'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, House, Loader2, ScanLine, Unlink } from 'lucide-react';
import { QrScanner } from '@/components/carto/QrScanner';
import { AppShell, MobileActionBar } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';

type ActiveSessionSummary = {
  sessionId: string;
  status: string;
  cartCode: string;
  cartStatus: string;
  receiptId: string | null;
  shoppingList: {
    id: string;
    name: string;
    itemsCount: number;
  };
};

type ReadySessionResponse = {
  session: {
    id: string;
    status: string;
    endedAt?: string | null;
    shoppingList: {
      id: string;
      name: string;
      items: Array<{ id: string }>;
    } | null;
    cart: {
      cartCode: string;
      status?: string | null;
    } | null;
  };
  receipt: {
    id: string;
    status: string;
    total: number;
    paymentStatus?: string | null;
  } | null;
};

type DisconnectCartResponse = {
  disconnected: boolean;
  sessionId: string;
  cartCode: string;
  cartStatus: 'AVAILABLE';
};

type PaymentScanValidationResponse = {
  sessionId: string;
  receiptId: string | null;
  checkoutUrl?: string | null;
};

type CurrentSessionResponse =
  | { success: true; data: { active: false } }
  | { success: true; data: { active: true; session: ActiveSessionSummary } }
  | { success: false; error?: string | { message?: string } };

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
    statusCode: typeof data.statusCode === 'number' ? data.statusCode : null,
  };
}

function isInternalCheckoutUrl(checkoutUrl: string) {
  return checkoutUrl.startsWith('/');
}

function ReadySessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [sessionData, setSessionData] = useState<ReadySessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingCurrentSession, setIsCheckingCurrentSession] = useState(true);
  const [currentSession, setCurrentSession] = useState<ActiveSessionSummary | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [isValidatingQr, setIsValidatingQr] = useState(false);
  const [error, setError] = useState('');

  const loadSessionSnapshot = useCallback(async (signal?: AbortSignal) => {
    if (!sessionId) {
      throw new Error('Missing session ID.');
    }

    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      cache: 'no-store',
      signal,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data?.data?.session) {
      throw new Error(getApiErrorMessage(data, 'Could not load your cart session.'));
    }

    return data.data as ReadySessionResponse;
  }, [sessionId]);

  const fetchSession = useCallback(async (signal?: AbortSignal) => {
    if (!sessionId) {
      setError('Missing session ID.');
      setIsLoading(false);
      return;
    }

    try {
      const nextSessionData = await loadSessionSnapshot(signal);
      setSessionData(nextSessionData);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not load your cart session.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [loadSessionSnapshot, sessionId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSession(controller.signal);
    return () => controller.abort();
  }, [fetchSession]);

  const refreshCurrentSession = useCallback(async () => {
    try {
      const response = await fetch('/api/cart/current-session', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data: CurrentSessionResponse = await response.json().catch(() => ({ success: false }));

      if (!response.ok || data.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not check the current cart session.'));
      }

      if (data.data.active) {
        setCurrentSession(data.data.session);
      } else {
        setCurrentSession(null);
        setIsScannerOpen(false);
      }
    } catch (err: any) {
      setError((current) => current || err.message || 'Could not check the current cart session.');
    } finally {
      setIsCheckingCurrentSession(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const refreshLiveState = async () => {
      if (cancelled) return;
      await refreshCurrentSession();
      if (cancelled) return;
    };

    void refreshLiveState();
    intervalId = window.setInterval(() => {
      void refreshLiveState();
    }, 3000);

    const handleWindowFocus = () => {
      void refreshLiveState();
    };

    const handlePageShow = () => {
      void refreshLiveState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshLiveState();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshCurrentSession]);

  const startHostedCheckout = useCallback(async (options?: {
    validatedReceiptId?: string | null;
  }) => {
    if (!sessionId || !sessionData || isContinuing || isDisconnecting) return;

    const validatedReceiptId = options?.validatedReceiptId;
    const initialReceiptId = validatedReceiptId || sessionData.receipt?.id || null;
    const latestSessionData =
      validatedReceiptId
        ? sessionData
        : await loadSessionSnapshot().catch(() => sessionData);
    const resolvedReceiptId = initialReceiptId || latestSessionData?.receipt?.id || undefined;

    if (latestSessionData && latestSessionData !== sessionData) {
      setSessionData(latestSessionData);
    }

    if (latestSessionData?.receipt?.status === 'PAID') {
      const params = new URLSearchParams({ sessionId });
      if (latestSessionData.receipt?.id) {
        params.set('receiptId', latestSessionData.receipt.id);
      }
      router.replace(`/payment/success?${params.toString()}`);
      return;
    }

    setIsContinuing(true);
    setError('');

    try {
      const response = await fetch('/api/payments/paymob/create-checkout', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          receiptId: resolvedReceiptId,
          paymentMethod: 'CARD',
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        console.error('Hosted checkout initialization failed.', {
          status: response.status,
          sessionId,
          receiptId: resolvedReceiptId || null,
          error: getApiErrorDebug(data),
        });
        throw new Error(getApiErrorMessage(data, 'Could not prepare secure payment.'));
      }

      const paymentAttemptId = data.data?.paymentAttemptId || data.data?.attemptId;
      const checkoutUrl = data.data?.checkoutUrl || data.data?.paymentUrl;

      if (paymentAttemptId) {
        window.localStorage.setItem(LAST_PAYMENT_ATTEMPT_KEY, paymentAttemptId);
      }

      if (data.data?.alreadyPaid) {
        const params = new URLSearchParams({ sessionId });
        if (data.data?.receiptId) {
          params.set('receiptId', data.data.receiptId);
        }
        if (paymentAttemptId) {
          params.set('attemptId', paymentAttemptId);
        }
        router.replace(`/payment/success?${params.toString()}`);
        return;
      }

      if (!checkoutUrl) {
        throw new Error('Secure payment checkout URL is missing.');
      }

      if (isInternalCheckoutUrl(checkoutUrl)) {
        router.push(checkoutUrl);
        return;
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error('Hosted checkout initialization threw an unexpected error.', {
        sessionId,
        receiptId: resolvedReceiptId || null,
        message: err?.message || 'Unknown error',
      });
      setError(err.message || 'Could not prepare secure payment.');
      setIsContinuing(false);
    }
  }, [isContinuing, isDisconnecting, loadSessionSnapshot, router, sessionData, sessionId]);

  const handleScanDetected = useCallback(async (qrValue: string) => {
    if (!sessionId || isValidatingQr || isContinuing || isDisconnecting) {
      return false;
    }

    setIsValidatingQr(true);
    setError('');

    try {
      const response = await fetch('/api/payments/scan/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrValue }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Invalid payment QR code.'));
      }

      const validationData = data.data as PaymentScanValidationResponse;

      if (validationData.sessionId !== sessionId) {
        throw new Error('This payment QR code is for a different cart session.');
      }

      setIsScannerOpen(false);
      if (validationData.checkoutUrl) {
        if (isInternalCheckoutUrl(validationData.checkoutUrl)) {
          router.push(validationData.checkoutUrl);
          return true;
        }

        window.location.href = validationData.checkoutUrl;
        return true;
      }
      await startHostedCheckout({ validatedReceiptId: validationData.receiptId });
      return true;
    } catch (err: any) {
      setError(err.message || 'Invalid payment QR code.');
      return false;
    } finally {
      setIsValidatingQr(false);
    }
  }, [isContinuing, isDisconnecting, isValidatingQr, router, sessionId, startHostedCheckout]);

  const handleDisconnect = useCallback(async () => {
    if (!sessionId || !sessionData || isDisconnecting) return;

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

      const disconnectData = data.data as DisconnectCartResponse;

      if (!disconnectData?.disconnected) {
        throw new Error('Could not disconnect this cart.');
      }

      setCurrentSession(null);
      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
      setIsDisconnectConfirmOpen(false);
    }
  }, [isDisconnecting, router, sessionData, sessionId]);

  if (isLoading || isCheckingCurrentSession) {
    return (
      <AppShell variant="focus" title="Checkout" back="/dashboard" maxWidth="md">
        <LoadingState label="Preparing your cart…" />
      </AppShell>
    );
  }

  if (!sessionData) {
    return (
      <AppShell variant="focus" title="Checkout" back="/dashboard" maxWidth="md">
        <EmptyState
          icon={CircleAlert}
          tone="danger"
          title="Cart session unavailable"
          description={error || 'We could not find the linked cart session.'}
          actionLabel="Back to home"
          actionHref="/dashboard"
        />
      </AppShell>
    );
  }

  const currentSessionMatchesPage = currentSession?.sessionId === sessionId;
  const hasActiveSession = Boolean(currentSessionMatchesPage);
  const isPaymentRetryState =
    !hasActiveSession &&
    (sessionData.session.status === 'COMPLETED' || sessionData.session.status === 'CHECKED_OUT') &&
    sessionData.receipt?.status !== 'PAID' &&
    sessionData.receipt?.paymentStatus !== 'COMPLETED';
  const sessionEndedOrDisconnected = !hasActiveSession && !isPaymentRetryState;
  const listName = currentSessionMatchesPage
    ? currentSession.shoppingList.name
    : sessionData.session.shoppingList?.name || 'Selected list';
  const itemCount = currentSessionMatchesPage
    ? currentSession.shoppingList.itemsCount
    : sessionData.session.shoppingList?.items?.length || 0;
  const cartCode = currentSessionMatchesPage
    ? currentSession.cartCode
    : sessionData.session.cart?.cartCode || 'Carto cart';
  const isBusy = isContinuing || isDisconnecting || isValidatingQr;
  const isPreparingQr = isContinuing || isValidatingQr;
  const scanDisabled = isBusy || sessionEndedOrDisconnected;

  const scanButton = (
    <Button size="lg" fullWidth onClick={() => setIsScannerOpen(true)} disabled={scanDisabled} loading={isPreparingQr}>
      {!isPreparingQr && <ScanLine aria-hidden="true" />}
      {isPreparingQr ? 'Preparing payment…' : 'Scan payment QR'}
    </Button>
  );

  return (
    <AppShell variant="focus" title="Checkout" onBack={() => router.push('/dashboard')} maxWidth="md" bottomBar>
      <PageHeader
        eyebrow={
          <Badge tone={hasActiveSession ? 'success' : isPaymentRetryState ? 'warning' : 'neutral'} dot pulse={hasActiveSession}>
            {hasActiveSession ? 'Cart connected' : isPaymentRetryState ? 'Payment pending' : 'Session ended'}
          </Badge>
        }
        title={sessionEndedOrDisconnected ? 'This session has ended' : 'Ready to check out?'}
        description={
          hasActiveSession
            ? `Your session is live on ${cartCode}. When you are done, scan the payment QR shown on the cart.`
            : isPaymentRetryState
              ? 'The cart is no longer connected, but you can still finish paying for this receipt.'
              : 'This cart session has ended or been disconnected. Start a new one from your lists.'
        }
      />

      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="summary-heading" className="surface-card p-5">
          <h2 id="summary-heading" className="eyebrow">
            Session
          </h2>
          <DescriptionList
            className="mt-3"
            items={[
              { label: 'List', value: listName },
              { label: 'Items', value: `${itemCount} item${itemCount === 1 ? '' : 's'}` },
              { label: 'Cart', value: cartCode, mono: true },
            ]}
          />
        </section>

        <section aria-labelledby="how-heading" className="surface-card p-5">
          <h2 id="how-heading" className="eyebrow">
            How to pay
          </h2>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              'Tap “Scan payment QR” below.',
              'Point your camera at the QR on the cart screen.',
              'Pay securely on the Paymob checkout page.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-ink-muted">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-6 hidden lg:block">{scanButton}</div>

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            router.replace('/dashboard');
            router.refresh();
          }}
          disabled={isBusy}
        >
          <House aria-hidden="true" />
          Back to home
        </Button>
        <Button
          variant="danger-soft"
          onClick={() => setIsDisconnectConfirmOpen(true)}
          disabled={!hasActiveSession || isBusy}
        >
          <Unlink aria-hidden="true" />
          Disconnect cart
        </Button>
      </div>

      <MobileActionBar>{scanButton}</MobileActionBar>

      <Modal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        dismissible={!isValidatingQr}
        title="Scan payment QR"
        description="Only the checkout QR for this session is accepted."
      >
        <QrScanner onDetected={handleScanDetected} />
        {isValidatingQr && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-muted" aria-live="polite">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            Checking the QR code…
          </p>
        )}
        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}
      </Modal>

      <Modal
        open={isDisconnectConfirmOpen}
        onClose={() => setIsDisconnectConfirmOpen(false)}
        dismissible={!isDisconnecting}
        size="sm"
        title="Disconnect this cart?"
        description="Your list will be removed from the cart display and this session will end."
        footer={
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <Button variant="outline" onClick={() => setIsDisconnectConfirmOpen(false)} disabled={isDisconnecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDisconnect()} loading={isDisconnecting}>
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        }
      />
    </AppShell>
  );
}

export default function ReadySessionPage() {
  return (
    <Suspense
      fallback={
        <AppShell variant="focus" title="Checkout" back="/dashboard" maxWidth="md">
          <LoadingState label="Preparing your cart…" />
        </AppShell>
      }
    >
      <ReadySessionContent />
    </Suspense>
  );
}
