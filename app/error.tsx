'use client';

import { useEffect } from 'react';
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
    <div className="min-h-screen flex items-center justify-center bg-background-light px-4">
      <div className="max-w-md w-full text-center bg-white/90 backdrop-blur-xl p-12 rounded-[2.5rem] border border-warm-border/50 shadow-soft">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-950 tracking-tight mb-4">Something went wrong</h1>
        <p className="text-slate-500 mb-10 leading-relaxed font-medium">{error.message || 'An unexpected error occurred while processing your request.'}</p>
        <div className="space-y-4">
          <button
            onClick={reset}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            TRY AGAIN
          </button>
          <Link href="/dashboard" className="block">
            <button className="w-full py-4 bg-primary-soft hover:bg-white text-primary font-bold rounded-2xl border border-warm-border/60 transition-all text-sm">
              GO TO DASHBOARD
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

