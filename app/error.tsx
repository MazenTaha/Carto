'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong!</h1>
        <p className="text-gray-600 mb-6">{error.message || 'An unexpected error occurred'}</p>
        <div className="space-y-3">
          <Button onClick={reset} variant="primary" className="w-full">
            Try Again
          </Button>
          <Link href="/auth/signin">
            <Button variant="outline" className="w-full">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

