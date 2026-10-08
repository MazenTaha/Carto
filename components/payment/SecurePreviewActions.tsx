'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Unlink } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';

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
    <div className="pt-2">
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <ButtonLink href={returnHref} size="lg">
          Back to session
        </ButtonLink>
        <ButtonLink href="/dashboard" size="lg" variant="outline">
          Home
        </ButtonLink>
        <Button size="lg" variant="danger-soft" onClick={() => void handleDisconnect()} loading={isDisconnecting}>
          {!isDisconnecting && <Unlink aria-hidden="true" />}
          {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </div>
    </div>
  );
}
