'use client';

import { TriangleAlert } from 'lucide-react';
import './globals.css';

// Rendered outside the root layout, so it cannot rely on fonts or providers being available.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card sm:p-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-100">
              <TriangleAlert className="size-8" aria-hidden="true" />
            </div>
            <h1 className="mt-6 text-2xl font-bold">Carto hit a critical error</h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-ink-muted">
              {error.message || 'A critical application error occurred while loading this page.'}
            </p>
            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={reset}
                className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-brand transition hover:bg-primary-hover"
              >
                Try again
              </button>
              <a
                href="/auth/signin"
                className="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
              >
                Return to sign in
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
