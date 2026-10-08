'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { Button } from '@/components/ui/Button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="surface-card">
      <EmptyState
        tone="danger"
        icon={<TriangleAlert />}
        title="This admin page could not load"
        description={error.message || 'An unexpected error occurred.'}
        action={
          <Button onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </div>
  );
}
