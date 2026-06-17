'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrScanner } from '@/components/carto/QrScanner';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';

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
    }
  }, [isDisconnecting, router, sessionData, sessionId]);

  if (isLoading || isCheckingCurrentSession) {
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
  const scanDisabled = isBusy || sessionEndedOrDisconnected;

  return (
    <PageContainer maxWidth="md">
      <Header showBack onBack={() => router.push('/dashboard')} />

      <main className="flex min-h-[calc(100dvh-4.5rem)] flex-col justify-center px-4 pb-32 pt-6 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-soft">
          <div className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%)] p-6 sm:p-8">
            <Badge variant={hasActiveSession ? 'connected' : 'warning'}>
              {hasActiveSession ? 'Cart connected' : isPaymentRetryState ? 'Payment ready' : 'Session ended'}
            </Badge>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Your cart session</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              {hasActiveSession
                ? `Your smart cart session is live on ${cartCode}. Continue whenever you are ready to move into secure checkout.`
                : isPaymentRetryState
                  ? 'This cart session is no longer connected, but your secure checkout link is still available to retry safely.'
                  : 'This cart session has ended or been disconnected. Return home to start a new activation when you are ready.'}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">shopping_cart_checkout</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Next step: secure checkout</h2>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {hasActiveSession
                  ? 'Scan the checkout QR code to continue to payment.'
                  : isPaymentRetryState
                    ? 'This session is already finalized, so scanning will open checkout directly.'
                    : 'Session ended or disconnected. Payment actions are unavailable on this page now.'}
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

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-4">
        <div className="mx-auto max-w-xl rounded-[1.75rem] border border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/96">
          <Button
            type="button"
            size="md"
            className="h-11 w-full rounded-2xl"
            onClick={() => setIsScannerOpen(true)}
            disabled={scanDisabled}
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            {isValidatingQr ? 'Validating QR...' : 'Scan payment QR'}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-2xl"
              onClick={() => {
                router.replace('/dashboard');
                router.refresh();
              }}
            >
              Back to home
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="col-span-2 h-10 rounded-2xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              onClick={() => void handleDisconnect()}
              disabled={!hasActiveSession || isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect cart'}
            </Button>
          </div>
        </div>
      </div>

      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden bg-slate-950/75 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close payment scanner"
            onClick={() => {
              if (!isValidatingQr) {
                setIsScannerOpen(false);
              }
            }}
            disabled={isValidatingQr}
          />
          <div className="relative z-[101] w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-5 sm:p-6">
              <Badge className="bg-primary/10 text-primary ring-primary/10">Checkout scanner</Badge>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Scan payment QR</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Scan the checkout QR code to continue to payment. Only Carto checkout QR codes for this session are accepted.
              </p>

              <div className="mt-5 flex justify-center">
                <QrScanner onDetected={handleScanDetected} />
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 rounded-2xl"
                  onClick={() => setIsScannerOpen(false)}
                  disabled={isValidatingQr}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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
