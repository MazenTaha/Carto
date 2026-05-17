'use client';

import { AlertTriangle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle size={24} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-slate-500">{error.message ?? 'An unexpected error occurred.'}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  );
}
