'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { z } from 'zod';
import {
  Check,
  CircleCheck,
  ClipboardList,
  CreditCard,
  Info,
  ListChecks,
  Pencil,
  RotateCcw,
  ShoppingBasket,
  ShoppingCart,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { QrScanner } from '@/components/carto/QrScanner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState, Skeleton } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EMPTY_LIST_MESSAGE } from '@/lib/list-constants';
import { cn } from '@/lib/utils';
import { cartQrPayloadSchema } from '@/lib/validations';

type CartQrPayload = z.infer<typeof cartQrPayloadSchema>;

type SelectedListSummary = {
  id: string;
  name: string;
  items?: Array<{ id: string }>;
};

type ExistingSessionSummary = {
  sessionId: string;
  cartCode: string;
  listName: string;
};

type ActiveSessionResponse =
  | { success: true; data: { active: false } }
  | {
      success: true;
      data: {
        active: true;
        session: {
          id: string;
          cart?: { cartCode?: string | null } | null;
          shoppingList?: { id?: string | null; name?: string | null } | null;
        };
      };
    }
  | { success: false; error?: string | { message?: string; code?: string } };

type PairingStep = 'scanning' | 'confirming' | 'submitting';

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function parseCartQr(raw: string): { cart?: CartQrPayload; error?: string } {
  try {
    const parsed = JSON.parse(raw.trim());
    const result = cartQrPayloadSchema.safeParse(parsed);

    if (!result.success) {
      return { error: result.error.errors[0]?.message || 'QR code is missing required cart details.' };
    }

    return { cart: result.data };
  } catch {
    return { error: 'This QR code is not a valid Carto cart code. Please scan the live QR shown on the cart.' };
  }
}

function StartSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scannedCart, setScannedCart] = useState<CartQrPayload | null>(null);
  const [selectedList, setSelectedList] = useState<SelectedListSummary | null>(null);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isCheckingExistingSession, setIsCheckingExistingSession] = useState(true);
  const [existingSession, setExistingSession] = useState<ExistingSessionSummary | null>(null);
  const [pairingStep, setPairingStep] = useState<PairingStep>('scanning');
  const [scannerKey, setScannerKey] = useState(0);
  const linkInFlightRef = useRef(false);
  const latestScannedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function checkExistingSession() {
      try {
        const response = await fetch('/api/sessions/active', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          return;
        }

        const activeSession = data?.data?.active ? data?.data?.session : null;

        if (!controller.signal.aborted && activeSession?.id && activeSession?.cart?.cartCode) {
          setExistingSession({
            sessionId: activeSession.id,
            cartCode: activeSession.cart.cartCode,
            listName: activeSession.shoppingList?.name || 'your active list',
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingExistingSession(false);
        }
      }
    }

    void checkExistingSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!listId) return;
    const currentListId = listId;

    const controller = new AbortController();
    setIsListLoading(true);

    async function fetchSelectedList() {
      try {
        const response = await fetch(`/api/lists/${encodeURIComponent(currentListId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(getApiErrorMessage(data, 'Could not load the selected shopping list.'));
        }

        if (!controller.signal.aborted) {
          setSelectedList(data.data);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(err.message || 'Could not load the selected shopping list.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsListLoading(false);
        }
      }
    }

    void fetchSelectedList();
    return () => controller.abort();
  }, [listId]);

  const resetScanner = useCallback(() => {
    setScannedCart(null);
    setError('');
    setIsLoading(false);
    setPairingStep('scanning');
    latestScannedSignatureRef.current = null;
    setScannerKey((current) => current + 1);
  }, []);

  const redirectToExistingSession = useCallback(async (options?: {
    preferredCartCode?: string | null;
    preferredListId?: string | null;
  }) => {
    try {
      const response = await fetch('/api/sessions/active', {
        cache: 'no-store',
      });
      const data: ActiveSessionResponse = await response.json().catch(() => ({ success: false }));

      if (!response.ok || data.success === false || !data.data.active || !data.data.session?.id) {
        return false;
      }

      const session = data.data.session;
      const matchesPreferredCart =
        !options?.preferredCartCode ||
        session.cart?.cartCode?.toLowerCase() === options.preferredCartCode.toLowerCase();
      const matchesPreferredList =
        !options?.preferredListId ||
        session.shoppingList?.id === options.preferredListId;

      if (!matchesPreferredCart || !matchesPreferredList) {
        return false;
      }

      router.replace(`/session/ready?sessionId=${encodeURIComponent(session.id)}`);
      return true;
    } catch {
      return false;
    }
  }, [router]);

  const linkCart = useCallback(async () => {
    if (!listId) {
      setError('List ID is missing.');
      return;
    }

    if (!scannedCart?.cartCode || !scannedCart?.pairingCode) {
      setError('Scan a cart QR code before continuing.');
      return;
    }

    if (linkInFlightRef.current) {
      return;
    }

    linkInFlightRef.current = true;
    setIsLoading(true);
    setPairingStep('submitting');
    setError('');

    try {
      const response = await fetch('/api/cart/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId,
          cartCode: scannedCart.cartCode.trim(),
          pairingCode: scannedCart.pairingCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        const errorCode = data?.error?.code;

        if (errorCode === 'ACTIVE_SESSION_EXISTS') {
          const redirected = await redirectToExistingSession();
          if (redirected) {
            return;
          }
        }

        if (errorCode === 'CART_LINK_CONFLICT') {
          const redirected = await redirectToExistingSession({
            preferredCartCode: scannedCart.cartCode,
            preferredListId: listId,
          });
          if (redirected) {
            return;
          }
        }

        if (errorCode === 'EXPIRED_PAIRING_CODE') {
          throw new Error('QR expired. Please scan the refreshed QR.');
        }

        if (errorCode === 'CART_IN_USE') {
          throw new Error('This cart is already in use.');
        }

        throw new Error(getApiErrorMessage(data, 'Failed to link cart.'));
      }

      const redirectUrl = data?.data?.redirectUrl;
      const sessionId = data?.data?.sessionId || data?.data?.cartSessionId || data?.data?.id;

      if (redirectUrl) {
        router.replace(redirectUrl);
        return;
      }

      if (!sessionId) {
        throw new Error('Cart linked, but the backend did not return a session ID.');
      }

      router.replace(`/session/ready?sessionId=${encodeURIComponent(sessionId)}`);
    } catch (err: any) {
      setPairingStep('confirming');
      setError(err.message || 'An error occurred.');
    } finally {
      linkInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [listId, redirectToExistingSession, router, scannedCart]);

  const handleDetected = useCallback((raw: string) => {
    setError('');
    const result = parseCartQr(raw);

    if (result.error || !result.cart) {
      setScannedCart(null);
      setPairingStep('scanning');
      setError(result.error || 'Invalid cart QR code.');
      return false;
    }

    const nextSignature = `${result.cart.type}:${result.cart.cartCode}:${result.cart.pairingCode}`;

    if (latestScannedSignatureRef.current === nextSignature) {
      setPairingStep('confirming');
      return true;
    }

    latestScannedSignatureRef.current = nextSignature;
    setScannedCart(result.cart);
    setPairingStep('confirming');
    return true;
  }, []);

  if (!listId) {
    return (
      <AppShell variant="focus" back="/lists?activate=1" title="Link a cart" maxWidth="sm">
        <EmptyState
          icon={ListChecks}
          title="No list selected"
          description="Choose the list you want to shop with before scanning the cart QR code."
          actionLabel="Choose a list"
          actionHref="/lists?activate=1"
        />
      </AppShell>
    );
  }

  if (isCheckingExistingSession) {
    return (
      <AppShell variant="focus" back="/lists?activate=1" title="Link a cart" maxWidth="sm">
        <LoadingState label="Checking for an active cart session…" />
      </AppShell>
    );
  }

  if (existingSession) {
    return (
      <AppShell variant="focus" back="/dashboard" title="Link a cart" maxWidth="sm">
        <EmptyState
          icon={ShoppingCart}
          title="A shopping session is already active"
          description={
            <>
              &quot;{existingSession.listName}&quot; is connected to {existingSession.cartCode}. Finish or disconnect that cart
              before starting another list.
            </>
          }
          action={
            <>
              <Button onClick={() => router.push(`/session?sessionId=${encodeURIComponent(existingSession.sessionId)}`)}>
                <ShoppingCart aria-hidden="true" />
                Continue session
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/session/ready?sessionId=${encodeURIComponent(existingSession.sessionId)}`)}
              >
                <CreditCard aria-hidden="true" />
                Continue to payment
              </Button>
            </>
          }
        />
      </AppShell>
    );
  }

  const listItemCount = selectedList?.items?.length ?? 0;

  if (!isListLoading && selectedList && listItemCount === 0) {
    return (
      <AppShell variant="focus" back="/lists?activate=1" title="Link a cart" maxWidth="sm">
        <EmptyState
          icon={ShoppingBasket}
          title="This list has no items yet"
          description={EMPTY_LIST_MESSAGE}
          action={
            <>
              <Button onClick={() => router.push(`/lists/${encodeURIComponent(listId)}`)}>
                <Pencil aria-hidden="true" />
                Add items
              </Button>
              <Button variant="outline" onClick={() => router.push('/lists?activate=1')}>
                Choose another list
              </Button>
            </>
          }
        />
      </AppShell>
    );
  }

  const steps = [
    { label: 'Scan the cart QR', done: Boolean(scannedCart), active: !scannedCart },
    { label: 'Confirm the cart', done: pairingStep === 'submitting', active: pairingStep === 'confirming' },
    { label: 'List appears on the cart', done: false, active: pairingStep === 'submitting' },
  ];

  return (
    <AppShell variant="focus" back="/lists?activate=1" title="Link a cart" maxWidth="lg">
      <PageHeader
        eyebrow={<Badge tone="brand">Step 2 of 2 · Link a cart</Badge>}
        title="Scan the QR on your cart"
        description="Point your camera at the QR code on the cart's screen. You will confirm before your list is sent."
      />

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
        <div>
          {scannedCart ? (
            <div className="surface-card mx-auto flex aspect-square w-full max-w-sm flex-col items-center justify-center p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CircleCheck className="size-7" aria-hidden="true" />
              </span>
              <p className="mt-4 font-display text-xl font-semibold">{scannedCart.cartCode} detected</p>
              <p className="mt-1 text-sm text-ink-muted">Camera paused. Confirm to send your list.</p>
              <Button variant="ghost" className="mt-4" onClick={resetScanner} disabled={isLoading}>
                <RotateCcw aria-hidden="true" />
                Scan a different cart
              </Button>
            </div>
          ) : (
            <QrScanner key={scannerKey} onDetected={handleDetected} />
          )}

          {error && !scannedCart && (
            <Alert tone="danger" className="mx-auto mt-4 max-w-sm">
              {error}
            </Alert>
          )}
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <p className="eyebrow">Shopping with</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary">
                <ClipboardList className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                {isListLoading ? (
                  <>
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-20" />
                  </>
                ) : (
                  <>
                    <p className="truncate font-semibold text-ink">{selectedList?.name || 'Selected list'}</p>
                    <p className="text-sm text-ink-subtle">
                      {listItemCount} item{listItemCount === 1 ? '' : 's'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <p className="eyebrow">Progress</p>
            <ol className="mt-3 space-y-3" aria-live="polite">
              {steps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      step.done
                        ? 'bg-emerald-500 text-white'
                        : step.active
                          ? 'bg-primary text-white'
                          : 'bg-surface-muted text-ink-subtle ring-1 ring-line'
                    )}
                  >
                    {step.done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn(step.active || step.done ? 'font-medium text-ink' : 'text-ink-subtle')}>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="flex gap-2 px-1 text-xs leading-5 text-ink-subtle">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            The camera needs HTTPS and permission. The QR on the cart refreshes regularly, so scan the one currently shown.
          </p>
        </aside>
      </div>

      <Modal
        open={Boolean(scannedCart)}
        onClose={resetScanner}
        dismissible={!isLoading}
        title={scannedCart ? `Send your list to ${scannedCart.cartCode}?` : undefined}
        description="This starts a live cart session and shows your list on the cart display."
        footer={
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <Button variant="outline" size="lg" onClick={resetScanner} disabled={isLoading}>
              Scan again
            </Button>
            <Button size="lg" onClick={() => void linkCart()} loading={isLoading} disabled={isListLoading}>
              {isLoading ? 'Sending…' : 'Send list'}
            </Button>
          </div>
        }
      >
        {scannedCart && (
          <>
            <DescriptionList
              className="rounded-xl bg-surface-muted px-4 py-3"
              items={[
                { label: 'List', value: selectedList?.name || 'Selected list' },
                { label: 'Cart', value: scannedCart.cartCode, mono: true },
                { label: 'Items', value: listItemCount },
              ]}
            />
            {error && (
              <Alert tone="danger" className="mt-4">
                {error}
              </Alert>
            )}
          </>
        )}
      </Modal>
    </AppShell>
  );
}

export default function StartSessionPage() {
  return (
    <Suspense
      fallback={
        <AppShell variant="focus" back="/lists?activate=1" title="Link a cart" maxWidth="sm">
          <LoadingState />
        </AppShell>
      }
    >
      <StartSessionContent />
    </Suspense>
  );
}
