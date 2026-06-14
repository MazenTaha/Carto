import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { NewListNamePageClient } from '@/components/lists/NewListNamePageClient';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';
import { requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_SESSION_CREATE_LIST_MESSAGE } from '@/lib/list-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewListPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  const activeSession = process.env.DATABASE_URL
    ? await getOwnedActiveCartSession(owner)
    : null;

  return (
    <PageContainer maxWidth="md">
      <Header title="Name your list" showBack showLogo />

      <main className="flex-1 pb-32 pt-6 md:pb-10">
        {activeSession ? (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-card dark:border-emerald-400/30 dark:bg-emerald-500/10">
            <Badge variant="connected">Cart connected</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">
              Another list cannot be created right now
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {ACTIVE_SESSION_CREATE_LIST_MESSAGE} Your list &quot;{activeSession.shoppingList.name}&quot; is already connected to {activeSession.cartCode}.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-95"
              >
                <span className="material-symbols-outlined">shopping_cart</span>
                Continue session
              </Link>
              <Link
                href={`/session/ready?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-5 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-slate-950 dark:text-emerald-300"
              >
                <span className="material-symbols-outlined">payments</span>
                Continue to payment
              </Link>
            </div>
          </section>
        ) : (
          <NewListNamePageClient />
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
