'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <StatusScreen
      icon={TriangleAlert}
      tone="danger"
      title="Something went wrong"
      description={error.message || 'An unexpected error occurred while processing your request.'}
      actions={
        <>
          <Button size="lg" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
          <ButtonLink href="/dashboard" size="lg" variant="outline">
            Go to home
          </ButtonLink>
        </>
      }
    />
  );
}
