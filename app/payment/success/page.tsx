import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

export default function PaymentSuccessPage() {
  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-10">
          <Link href="/dashboard" aria-label="Go to Carto home" className="mx-auto mb-8 flex w-fit justify-center">
            <Logo width={128} height={46} />
          </Link>

          <div className="relative mx-auto flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-20" />
            <span className="material-symbols-outlined text-5xl">check_circle</span>
          </div>

          <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">Payment confirmed</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            Paymob confirmed your payment through the verified backend flow. Your receipt is now marked as paid, and the cart session can safely move to checked out.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/history" className="inline-flex h-14 items-center justify-center rounded-2xl bg-primary px-5 text-base font-black text-white shadow-glow transition active:scale-[0.98]">
              View receipts
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
