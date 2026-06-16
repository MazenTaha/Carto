import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

export default function PaymentFailurePage({
  searchParams,
}: {
  searchParams?: { sessionId?: string; attemptId?: string };
}) {
  const sessionHref = searchParams?.sessionId
    ? `/session/ready?sessionId=${encodeURIComponent(searchParams.sessionId)}`
    : '/dashboard';

  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-10">
          <Link href="/dashboard" aria-label="Go to Carto home" className="mx-auto mb-8 flex w-fit justify-center">
            <Logo width={128} height={46} />
          </Link>

          <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/10">
            <span className="material-symbols-outlined text-5xl">error</span>
          </div>

          <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">Payment not completed</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            Paymob did not confirm this payment. Your receipt stays unpaid, and your cart session can stay recoverable so you can safely return and try again.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            Test mode payment. Your cart session is still active until a verified Paymob success webhook completes checkout.
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href={sessionHref} className="inline-flex h-14 items-center justify-center rounded-2xl bg-primary px-5 text-base font-black text-white shadow-glow transition active:scale-[0.98]">
              Back to my session
            </Link>
            <Link href="/dashboard" className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-base font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    </PageContainer>
  );
}
