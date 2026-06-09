import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';

export default function NotFound() {
  return (
    <PageContainer className="justify-center">
      <main className="flex min-h-screen items-center justify-center py-10">
        <div className="w-full max-w-md rounded-[2.5rem] border border-warm-border/50 bg-white/90 p-10 text-center shadow-soft backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
            <span className="material-symbols-outlined text-4xl text-primary">search_off</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Page not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            The page you requested is unavailable or may have moved.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/dashboard"
              className="block w-full rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-white shadow-glow transition hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/auth/signin"
              className="block w-full rounded-2xl border border-warm-border/60 bg-primary-soft px-5 py-4 text-sm font-bold text-primary transition hover:bg-white"
            >
              Open Sign In
            </Link>
          </div>
        </div>
      </main>
    </PageContainer>
  );
}
