'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background-light text-slate-900 antialiased">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-[2.5rem] border border-warm-border/50 bg-white/90 p-10 text-center shadow-soft backdrop-blur-xl">
            <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10">
              <span className="material-symbols-outlined text-4xl text-red-500">error</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Carto hit a critical error</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {error.message || 'A critical application error occurred while loading this page.'}
            </p>
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-white shadow-glow transition hover:bg-primary/90"
              >
                Try Again
              </button>
              <Link
                href="/auth/signin"
                className="block w-full rounded-2xl border border-warm-border/60 bg-primary-soft px-5 py-4 text-sm font-bold text-primary transition hover:bg-white"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
