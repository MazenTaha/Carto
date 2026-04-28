// Redesigned Connect to Cart page following Screen 5

'use client';

import { useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { QrScanner } from '@/components/carto/QrScanner';
import { cartQrPayloadSchema } from '@/lib/validations';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { z } from 'zod';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CartQrPayload = z.infer<typeof cartQrPayloadSchema>;

function parseCartQr(raw: string): { cart?: CartQrPayload; error?: string } {
  try {
    const parsed = JSON.parse(raw.trim());
    const result = cartQrPayloadSchema.safeParse(parsed);

    if (!result.success) {
      return { error: result.error.errors[0]?.message || 'QR code is missing required cart details.' };
    }

    return { cart: result.data };
  } catch {
    return { error: 'This QR code is not valid Carto JSON. Please scan the cart QR code or use manual entry.' };
  }
}

function StartSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');
  
  const [manualCartId, setManualCartId] = useState<string>('');
  const [manualPairingCode, setManualPairingCode] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scannedCart, setScannedCart] = useState<CartQrPayload | null>(null);

  const handleLink = useCallback(async () => {
    if (!listId) {
      setError('List ID is missing');
      return;
    }

    const payload = scannedCart
      ? { ...scannedCart, listId }
      : {
          cartId: manualCartId.trim(),
          pairingCode: manualPairingCode.trim(),
          listId,
        };

    if (!payload.cartId) {
      setError('Please scan a cart QR code or enter a cart ID.');
      return;
    }

    if (!payload.pairingCode) {
      setError('Please enter the cart pairing code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cart/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link cart');
      }

      router.push(`/session?sessionId=${data.data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [listId, manualCartId, manualPairingCode, router, scannedCart]);

  if (!listId) {
    return (
      <PageContainer className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No list selected</h2>
          <p className="mb-6 text-slate-500">Select the list you want to activate before scanning the cart QR code.</p>
          <button onClick={() => router.push('/lists?activate=1')} className="bg-primary text-white px-6 py-3 rounded-xl font-bold">
            Select a List
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header title="Connect to Cart" showBack={true} />

      <div className="flex-1 flex flex-col items-center px-6 pt-8 gap-6 overflow-y-auto pb-24">
        <div className="text-center space-y-2">
          <p className="text-primary text-xs font-bold uppercase tracking-[0.2em]">List selected</p>
          <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">Scan the cart QR code</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Point your camera at the QR code on the physical cart. Carto will immediately link this active list to that cart.
          </p>
        </div>

        <QrScanner
          onDetected={(raw) => {
            setError('');
            const result = parseCartQr(raw);

            if (result.error || !result.cart) {
              setScannedCart(null);
              setError(result.error || 'Invalid cart QR code.');
              return;
            }

            setScannedCart(result.cart);
            setManualCartId(result.cart.cartId);
            setManualPairingCode(result.cart.pairingCode);
          }}
        />

        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-primary/20 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight">Cart connection</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", scannedCart ? "bg-green-500" : "bg-yellow-500")}></span>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">
                  {scannedCart ? `Detected: ${scannedCart.cartId}` : "Waiting for cart QR"}
                </p>
              </div>
              {scannedCart && (
                <button
                  type="button"
                  onClick={() => {
                    setScannedCart(null);
                    setManualCartId('');
                    setManualPairingCode('');
                  }}
                  className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20"
                >
                  Clear
                </button>
              )}
            </div>
            {scannedCart && (
              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Bluetooth</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{scannedCart.bluetoothName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Pairing code</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{scannedCart.pairingCode}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">QR session</span>
                  <span className="max-w-[12rem] truncate font-semibold text-slate-900 dark:text-slate-100">{scannedCart.sessionId}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary Action */}
        <div className="w-full max-w-sm pt-2">
          <button
            onClick={handleLink}
            disabled={isLoading}
            className="w-full flex cursor-pointer items-center justify-center rounded-xl h-14 bg-primary text-white text-base font-bold shadow-lg shadow-primary/30 active:scale-95 transition-transform disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Connect to Cart"}
          </button>
          <label className="mt-4 block text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Manual cart ID
            <input
              value={manualCartId}
              onChange={(event) => {
                setManualCartId(event.target.value);
                setScannedCart(null);
              }}
              placeholder="cart-01"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base normal-case tracking-normal text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="mt-3 block text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Pairing code
            <input
              value={manualPairingCode}
              onChange={(event) => {
                setManualPairingCode(event.target.value);
                setScannedCart(null);
              }}
              inputMode="numeric"
              placeholder="739214"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base normal-case tracking-normal text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <p className="text-center text-slate-400 text-xs mt-4">
            The cart will show the selected list after the link succeeds.
          </p>
          {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
        </div>
      </div>

      <BottomNav />
    </PageContainer>
  );
}

export default function StartSessionPage() {
  return (
    <Suspense fallback={
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase text-sm">Loading...</p>
        </div>
      </PageContainer>
    }>
      <StartSessionContent />
    </Suspense>
  );
}
