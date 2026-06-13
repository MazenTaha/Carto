import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomNav } from '@/components/layout/BottomNav';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ShoppingList } from '@/types';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  let stats = { totalSpent: 0, savedLists: 0 };
  let recentLists: ShoppingList[] = [];
  const isGuest = owner.type === 'guest';
  let userName = isGuest ? 'Guest Shopper' : 'Alex';
  let activeSession = null as Awaited<ReturnType<typeof getOwnedActiveCartSession>>;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const ownerFilter = ownerWhere(owner);
      await purgeExpiredShoppingLists(prisma, ownerFilter);
      const [listsData, savedListsCount, receiptTotals, activeSessionData] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { ...ownerFilter, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 4,
          select: {
            id: true,
            name: true,
            userId: true,
            guestSessionId: true,
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                isCollected: true,
              },
            },
          },
        }),
        prisma.shoppingList.count({ where: { ...ownerFilter, deletedAt: null } }),
        prisma.receipt.aggregate({
          where: {
            ...ownerFilter,
            status: 'PAID',
          },
          _sum: { total: true },
        }),
        getOwnedActiveCartSession(owner),
      ]);

      recentLists = listsData as ShoppingList[];
      stats.savedLists = savedListsCount;
      stats.totalSpent = receiptTotals._sum.total || 0;
      activeSession = activeSessionData;
    } catch (error) {}
  }

  const hasActiveSession = Boolean(activeSession);

  return (
    <PageContainer maxWidth="lg">
      <header className="sticky top-0 z-40 -mx-4 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:-mx-5 sm:rounded-b-2xl sm:px-5 lg:-mx-6">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center gap-4">
          <Link href="/dashboard" aria-label="Go to Carto home" className="flex items-center rounded-xl transition hover:opacity-80">
            <Logo width={104} height={38} />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <Link href="/dashboard" className="rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary">Dashboard</Link>
            <Link href="/lists" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Lists</Link>
            <Link href="/history" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">History</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={isGuest ? 'muted' : 'success'} className="hidden sm:inline-flex">
              {isGuest ? 'Guest mode' : 'Signed in'}
            </Badge>
            <SignOutButton className="hidden sm:inline-flex" />
            {!isGuest && (
              <Link href="/profile" className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-primary/10 hover:text-primary dark:bg-slate-800 dark:text-slate-300" aria-label="Open profile">
                <span className="material-symbols-outlined">person</span>
              </Link>
            )}
            <SignOutButton variant="icon" className="sm:hidden" />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full min-w-0 max-w-full overflow-x-hidden pb-28 pt-6 md:pb-10">
        <section className="grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className="w-full max-w-full overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-soft md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge
                  variant={hasActiveSession ? 'connected' : 'success'}
                  className={!hasActiveSession ? 'bg-white/10 text-white ring-white/15' : ''}
                >
                  {hasActiveSession ? 'Cart connected' : 'Smart cart ready'}
                </Badge>
                <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight md:text-4xl">
                  {hasActiveSession
                    ? 'Active shopping session'
                    : `Welcome back, ${userName}. Choose a list and connect to a cart.`}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 md:text-base">
                  {hasActiveSession
                    ? `Your list "${activeSession?.shoppingList.name}" is currently connected to ${activeSession?.cartCode}. Continue the active session from here whenever you are ready.`
                    : 'Start by activating the list you want shown on the shopping cart. Carto will sync the items after the QR link succeeds.'}
                </p>

                {hasActiveSession && activeSession && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Cart</p>
                      <p className="mt-2 text-lg font-black">{activeSession.cartCode}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">List</p>
                      <p className="mt-2 truncate text-lg font-black">{activeSession.shoppingList.name}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Items</p>
                      <p className="mt-2 text-lg font-black">
                        {activeSession.shoppingList.itemsCount} item{activeSession.shoppingList.itemsCount === 1 ? '' : 's'}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                        {activeSession.cartStatus.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {hasActiveSession && activeSession ? (
                <div className="w-full md:w-auto">
                  <Link
                    href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 text-base font-black text-white transition hover:bg-white/15 active:scale-[0.98] md:w-auto"
                  >
                    <span className="material-symbols-outlined">shopping_cart</span>
                    Continue session
                  </Link>
                </div>
              ) : (
                <Link
                  href="/lists?activate=1"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-black text-white shadow-glow transition active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                  Start Shopping
                </Link>
              )}
            </div>
          </div>

          {!hasActiveSession && (
            <div className="w-full max-w-full rounded-3xl border border-primary/15 bg-primary/10 p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Next step</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">Activate a list</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Pick a saved list, scan the QR code on the physical cart, then the cart display can use that list.
                  </p>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                  <span className="material-symbols-outlined">shopping_cart_checkout</span>
                </div>
              </div>
              <Link href="/lists?activate=1" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-black text-primary shadow-sm transition hover:bg-primary hover:text-white">
                Select list to activate
              </Link>
            </div>
          )}
        </section>

        {!hasActiveSession && (
          <>
            <section className="mt-5 grid w-full min-w-0 gap-3 sm:grid-cols-2">
              <MetricCard
                icon="format_list_bulleted"
                label="Saved Lists"
                value={stats.savedLists}
                helper="Existing shopping lists"
                tone="slate"
              />
            </section>

            <section className="mt-6 grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <div className="w-full min-w-0 max-w-full rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Recent Lists</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Your latest shopping plans.</p>
                  </div>
                  <Link href="/lists" className="text-sm font-bold text-primary hover:underline">View all</Link>
                </div>

                {recentLists.length === 0 ? (
                  <EmptyState
                    icon="playlist_add"
                    title="No shopping lists yet"
                    description="Create your first list, then activate it when you are ready to link a cart."
                    actionLabel="Create list"
                    actionHref="/lists/new"
                  />
                ) : (
                  <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
                    {recentLists.map((list) => {
                      const totalItems = list.items?.length || 0;
                      const collectedItems = list.items?.filter((item: any) => item.isCollected).length || 0;
                      const percentage = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;

                      return (
                        <Link
                          key={list.id}
                          href={`/lists/${list.id}`}
                        className="group block w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary/30 hover:bg-white hover:shadow-card dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-black text-slate-950 group-hover:text-primary dark:text-slate-100">{list.name}</h3>
                              <p className="mt-1 text-sm text-slate-500">{totalItems} items ready</p>
                            </div>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">chevron_right</span>
                          </div>
                          <ProgressBar value={percentage} className="mt-4" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="w-full min-w-0 max-w-full rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Quick Actions</h2>
                <div className="mt-4 space-y-3">
                  <Link href="/lists/new" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-primary/30 hover:bg-primary/5 dark:border-slate-800">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined">add</span>
                    </span>
                    <span>
                      <span className="block font-black text-slate-950 dark:text-slate-100">Create list</span>
                      <span className="text-sm text-slate-500">Plan your next trip</span>
                    </span>
                  </Link>
                  <Link href="/session" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-primary/30 hover:bg-primary/5 dark:border-slate-800">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined">sensors</span>
                    </span>
                    <span>
                      <span className="block font-black text-slate-950 dark:text-slate-100">Active session</span>
                      <span className="text-sm text-slate-500">View cart progress</span>
                    </span>
                  </Link>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
