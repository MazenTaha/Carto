import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomNav } from '@/components/layout/BottomNav';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function ListsPage({
  searchParams,
}: {
  searchParams?: { activate?: string };
}) {
  let session = null;
  const isActivationFlow = searchParams?.activate === '1';
  const cookieStore = await cookies();
  const guestModeCookie = cookieStore.get('guest_mode');
  const isGuestMode = guestModeCookie?.value === 'true';

  if (!isGuestMode && process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    try {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth-config');
      session = await getServerSession(authOptions);
    } catch (error) {}
  }

  if (!session && !isGuestMode) {
    redirect('/auth/signin');
  }

  let lists: any[] = [];
  if (session && session.user?.id && !isGuestMode && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      lists = await prisma.shoppingList.findMany({
        where: { userId: session.user.id },
        include: { _count: { select: { items: true } } },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {}
  } else if (isGuestMode) {
    const guestSessionId = cookieStore.get('guest_session_id')?.value;
    if (guestSessionId) {
      const { getGuestLists } = await import('@/store/guest-store');
      lists = getGuestLists(guestSessionId).map((list) => ({
        ...list,
        _count: { items: list.items?.length || 0 },
      }));
    }
  }

  return (
    <PageContainer maxWidth="lg">
      <header className="-mx-4 sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:mx-0 sm:rounded-b-2xl sm:px-5">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/dashboard" aria-label="Go to Carto home" className="flex items-center rounded-xl transition hover:opacity-80">
            <Logo width={104} height={38} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={isActivationFlow ? 'success' : 'muted'}>
              {isActivationFlow ? 'Activation mode' : `${lists.length} lists`}
            </Badge>
            <Link href="/lists/new" className="hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-glow transition active:scale-95 sm:inline-flex">
              <span className="material-symbols-outlined text-[20px]">add</span>
              New List
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-28 pt-6 md:pb-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {isActivationFlow ? 'Cart linking' : 'Shopping plans'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">
              {isActivationFlow ? 'Select a list to activate' : 'My Shopping Lists'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              {isActivationFlow
                ? 'Choose the list you want linked to the physical cart. After selection, scan the QR code on the cart and the list items will be used for the active session.'
                : 'Build reusable grocery lists, then activate the right one when you are ready to scan a cart.'}
            </p>
          </div>
          <Link href="/lists/new" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:hidden">
            <span className="material-symbols-outlined">add</span>
            Create List
          </Link>
        </div>

        {isActivationFlow && (
          <section className="mb-6 grid gap-4 rounded-3xl border border-primary/15 bg-primary/10 p-5 shadow-card md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Activate means cart-ready</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The selected list will be sent into the cart-linking flow, where scanning the cart QR starts the session.
                </p>
              </div>
            </div>
            <Badge variant="success" className="w-fit">Step 1 of 2</Badge>
          </section>
        )}

        {lists.length === 0 ? (
          <EmptyState
            icon="format_list_bulleted_add"
            title="No shopping lists yet"
            description="Create a list first. When you are ready to shop, activate it and scan the QR code on your cart."
            actionLabel="Create your first list"
            actionHref="/lists/new"
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lists.map((list) => {
              const count = list._count?.items || 0;
              const href = isActivationFlow ? `/session/start?listId=${list.id}` : `/lists/${list.id}`;
              const updatedAt = list.updatedAt ? formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true }) : 'recently';

              return (
                <Link
                  key={list.id}
                  href={href}
                  className="group flex min-h-52 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[28px]">local_grocery_store</span>
                      </div>
                      <Badge variant={isActivationFlow ? 'success' : 'muted'}>
                        {isActivationFlow ? 'Tap to activate' : `${count} items`}
                      </Badge>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-black text-slate-950 group-hover:text-primary dark:text-slate-100">
                      {list.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">Updated {updatedAt}</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {isActivationFlow ? 'Open QR scanner' : 'Manage list'}
                    </span>
                    <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-primary group-hover:text-white dark:bg-slate-800">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>

      <Link href="/lists/new" className="fixed bottom-24 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-glow transition hover:scale-105 active:scale-95 md:hidden" aria-label="Create new list">
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>

      <BottomNav />
    </PageContainer>
  );
}
