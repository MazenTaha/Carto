// Redesigned Connect to Cart page following Screen 5

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function StartSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');
  
  const [cartCode, setCartCode] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedId, setDetectedId] = useState<string | null>(null);

  // Mock detection after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setDetectedId('#8829-XJ');
      setCartCode('8829-XJ');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLink = useCallback(async () => {
    const codeToUse = cartCode.trim() || detectedId?.replace('#', '');

    if (!codeToUse) {
      setError('Please enter or scan a cart code');
      return;
    }

    if (!listId) {
      setError('List ID is missing');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cart/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartCode: codeToUse, listId }),
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
  }, [cartCode, detectedId, listId, router]);

  if (!listId) {
    return (
      <PageContainer className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No list selected</h2>
          <button onClick={() => router.push('/lists')} className="bg-primary text-white px-6 py-3 rounded-xl font-bold">
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
          <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">Scan the QR code</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Align the QR code on your cart within the frame</p>
        </div>

        {/* Scanner Viewfinder */}
        <div className="relative w-full max-w-sm aspect-square bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl">
          {/* Mock Camera View */}
          <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
             <span className="material-symbols-outlined text-6xl text-slate-400">photo_camera</span>
          </div>

          {/* Viewfinder Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64 border-2 border-primary rounded-xl flex items-center justify-center">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg -mb-1 -mr-1"></div>

              {/* Scanning Line */}
              <div className="w-full h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(55,19,236,0.8)] absolute top-1/2 -translate-y-1/2 animate-bounce"></div>
            </div>
          </div>
        </div>

        {/* Detection Status Card */}
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-stretch gap-4 rounded-xl border border-primary/20 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight">Cart ID Detected</p>
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", detectedId ? "bg-green-500" : "bg-yellow-500")}></span>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">
                    {detectedId ? `ID: ${detectedId}` : "Searching..."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetectedId(null)}
                className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20"
              >
                Change
              </button>
            </div>
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
          <p className="text-center text-slate-400 text-xs mt-4">
            Manual Entry? <span className="text-primary font-medium cursor-pointer underline" onClick={() => {
              const code = prompt("Enter Cart ID:");
              if (code) setCartCode(code);
            }}>Enter Cart ID</span>
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
