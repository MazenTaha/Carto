'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { z } from 'zod';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { QrScanner } from '@/components/carto/QrScanner';
import { cartQrPayloadSchema } from '@/lib/validations';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CartQrPayload = z.infer<typeof cartQrPayloadSchema>;

type SelectedListSummary = {
  id: string;
  name: string;
  items?: Array<{ id: string }>;
};

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
  const [pairingStep, setPairingStep] = useState<PairingStep>('scanning');
  const [scannerKey, setScannerKey] = useState(0);
  const linkInFlightRef = useRef(false);

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
    setScannerKey((current) => current + 1);
  }, []);

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
        throw new Error(getApiErrorMessage(data, 'Failed to link cart.'));
      }

      const sessionId = data?.data?.sessionId || data?.data?.id;

      if (!sessionId) {
        throw new Error('Cart linked, but the backend did not return a session ID.');
      }

      router.push(`/session?sessionId=${encodeURIComponent(sessionId)}`);
    } catch (err: any) {
      setPairingStep('confirming');
      setError(err.message || 'An error occurred.');
    } finally {
      linkInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [listId, router, scannedCart]);

  const handleDetected = useCallback((raw: string) => {
    setError('');
    const result = parseCartQr(raw);

    if (result.error || !result.cart) {
      setScannedCart(null);
      setPairingStep('scanning');
      setError(result.error || 'Invalid cart QR code.');
      return false;
    }

    setScannedCart(result.cart);
    setPairingStep('confirming');
    return true;
  }, []);

  if (!listId) {
    return (
      <PageContainer className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">No list selected</h2>
          <p className="mb-6 text-slate-500">Select the list you want to activate before scanning the cart QR code.</p>
          <button
            onClick={() => router.push('/lists?activate=1')}
            className="rounded-xl bg-primary px-6 py-3 font-bold text-white"
          >
            Select a List
          </button>
        </div>
      </PageContainer>
    );
  }

  const listItemCount = selectedList?.items?.length ?? 0;

  return (
    <PageContainer>
      <Header title="Connect to Cart" showBack />

      <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-4 pb-24 pt-6 sm:px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">List selected</p>
          <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            Scan the cart QR code
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Use your phone camera to scan the QR on the physical cart, then confirm before your list is sent.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-primary/15 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Selected shopping list</p>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                {isListLoading ? 'Loading list...' : selectedList?.name || 'Selected list'}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {listItemCount} item{listItemCount === 1 ? '' : 's'} ready to send to the cart
              </p>
            </div>
            <Badge variant="warning" className="shrink-0">
              {pairingStep === 'confirming'
                ? 'Review'
                : pairingStep === 'submitting'
                  ? 'Connecting'
                  : 'Scanning'}
            </Badge>
          </div>
        </div>

        <QrScanner key={scannerKey} onDetected={handleDetected} />

        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Connection status</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={cn(
                'size-2.5 rounded-full',
                pairingStep === 'confirming' || pairingStep === 'submitting' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              )}
            />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {pairingStep === 'submitting'
                ? `Sending ${selectedList?.name || 'your list'} to ${scannedCart?.cartCode || 'cart'}...`
                : scannedCart
                  ? `Cart ${scannedCart.cartCode} detected and ready to confirm`
                  : 'Waiting for a valid cart QR scan'}
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          {!scannedCart && !error && (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              The camera will stop automatically when it finds a valid cart QR. You will get one confirmation step before the list is linked.
            </p>
          )}
        </div>
      </div>

      {scannedCart && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Close confirmation"
            onClick={() => {
              if (!isLoading) {
                resetScanner();
              }
            }}
            disabled={isLoading}
          />
          <div className="absolute inset-x-4 bottom-5 mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <Badge className="bg-primary/10 text-primary ring-primary/10">Cart detected</Badge>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">
              Send this list to {scannedCart.cartCode}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Confirm to start the live cart session and push <span className="font-bold text-slate-900 dark:text-slate-100">{selectedList?.name || 'your list'}</span> to the cart display.
            </p>

            <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">List</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedList?.name || 'Selected list'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Cart code</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{scannedCart.cartCode}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{listItemCount}</span>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={resetScanner}
                disabled={isLoading}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Scan again
              </button>
              <Button
                onClick={() => void linkCart()}
                disabled={isLoading || isListLoading}
                className="h-12"
              >
                {isLoading ? 'Sending...' : 'Send list'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </PageContainer>
  );
}

export default function StartSessionPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="text-sm font-bold uppercase text-slate-400">Loading...</p>
          </div>
        </PageContainer>
      }
    >
      <StartSessionContent />
    </Suspense>
  );
}
