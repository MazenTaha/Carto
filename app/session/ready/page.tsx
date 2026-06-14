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
import { isCurrentCustomerSessionLive } from '@/lib/current-cart-session';

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

const LAST_PAYMENT_ATTEMPT_KEY = 'carto_last_payment_attempt';

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
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
  const [isContinuing, setIsContinuing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isValidatingQr, setIsValidatingQr] = useState(false);
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

  const startHostedCheckout = useCallback(async (validatedReceiptId?: string | null) => {
    if (!sessionId || !sessionData || isContinuing || isDisconnecting) return;

    if (sessionData.receipt?.status === 'PAID') {
      const params = new URLSearchParams({ sessionId });
      if (sessionData.receipt?.id) {
        params.set('receiptId', sessionData.receipt.id);
      }
      router.replace(`/payment/success?${params.toString()}`);
      return;
    }

    setIsContinuing(true);
    setError('');

    try {
      const response = await fetch('/api/payments/paymob/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          receiptId: validatedReceiptId || sessionData.receipt?.id || undefined,
          paymentMethod: 'CARD',
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
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
      setError(err.message || 'Could not prepare secure payment.');
      setIsContinuing(false);
    }
  }, [isContinuing, isDisconnecting, router, sessionData, sessionId]);

  const handleBypassScan = useCallback(async () => {
    await startHostedCheckout();
  }, [startHostedCheckout]);

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
      await startHostedCheckout(validationData.receiptId);
      return true;
    } catch (err: any) {
      setError(err.message || 'Invalid payment QR code.');
      return false;
    } finally {
      setIsValidatingQr(false);
    }
  }, [isContinuing, isDisconnecting, isValidatingQr, router, sessionId, startHostedCheckout]);

  const handleDisconnect = useCallback(async () => {
    if (!sessionId || !sessionData || isDisconnecting || isContinuing) return;

    setIsDisconnecting(true);
    setError('');

    try {
      const response = await fetch('/api/cart/disconnect', {
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

      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
    }
  }, [isContinuing, isDisconnecting, router, sessionData, sessionId]);

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
  const sessionIsCurrent = isCurrentCustomerSessionLive({
    status: sessionData.session.status,
    endedAt: sessionData.session.endedAt ? new Date(sessionData.session.endedAt) : null,
    cartStatus: sessionData.session.cart?.status,
    receiptStatus: sessionData.receipt?.status,
    paymentStatus: sessionData.receipt?.paymentStatus,
  });
  const isBusy = isContinuing || isDisconnecting || isValidatingQr;

  return (
    <PageContainer maxWidth="md">
      <Header showBack onBack={() => router.push('/dashboard')} />

      <main className="flex min-h-[calc(100dvh-4.5rem)] flex-col justify-center px-4 pb-32 pt-6 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-soft">
          <div className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%)] p-6 sm:p-8">
            <Badge variant="connected">Cart connected</Badge>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Enjoy your shopping :)</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Your smart cart session is live on {cartCode}. Continue whenever you are ready to move into payment.
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
              <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Next step: payment</h2>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {sessionIsCurrent
                  ? 'Scan the checkout QR code to continue to payment. Bypass scan is available for demos and testing only.'
                  : 'This session is already finalized, so scanning or bypassing will open checkout directly.'}
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
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] min-[560px]:grid-cols-2">
          <Button
            type="button"
            className="h-12 rounded-2xl"
            onClick={() => setIsScannerOpen(true)}
            disabled={isBusy}
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            {isValidatingQr ? 'Validating QR...' : 'Scan payment QR'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-2xl"
            onClick={() => void handleBypassScan()}
            disabled={isBusy}
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            {isContinuing ? 'Preparing payment...' : 'Bypass scan'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl"
            onClick={() => {
              router.replace('/dashboard');
              router.refresh();
            }}
            disabled={isBusy}
          >
            Back to home
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
            onClick={() => void handleDisconnect()}
            disabled={!sessionIsCurrent || isBusy}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect cart'}
          </Button>
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
