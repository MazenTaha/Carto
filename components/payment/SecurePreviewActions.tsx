'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

type SecurePreviewActionsProps = {
  returnHref: string;
  sessionId: string;
};

export function SecurePreviewActions({ returnHref, sessionId }: SecurePreviewActionsProps) {
  const router = useRouter();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');

  async function handleDisconnect() {
    if (isDisconnecting) return;

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

      router.replace('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Could not disconnect this cart.');
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={returnHref}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-[0.98]"
        >
          Back to my session
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          Back to home
        </Link>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-2xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
          onClick={() => void handleDisconnect()}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect cart'}
        </Button>
      </div>
    </div>
  );
}
