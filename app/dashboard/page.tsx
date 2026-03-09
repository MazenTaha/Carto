// Dashboard page - redesigned following Screen 4

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomNav } from '@/components/layout/BottomNav';
import { ShoppingList } from '@/types';

export default async function DashboardPage() {
  let session = null;

  // Check for guest mode
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

  let stats = { totalSpent: 0, totalOrders: 0, savedLists: 0 };
  let recentLists: ShoppingList[] = [];
  let userName = session?.user?.name || 'Alex';

  if (session && session.user?.id && !isGuestMode && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const [listsData, userStats] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { userId: session.user.id },
          orderBy: { updatedAt: 'desc' },
          take: 3,
        }),
        prisma.userStats.findUnique({
          where: { userId: session.user.id }
        })
      ]);
      recentLists = listsData;
      stats.savedLists = await prisma.shoppingList.count({ where: { userId: session.user.id } });
      if (userStats) {
        stats.totalSpent = userStats.totalSpent,
        stats.totalOrders = userStats.totalOrders
      }
    } catch (error) {}
  } else if (isGuestMode) {
     const guestSessionId = cookieStore.get('guest_session_id')?.value;
     if (guestSessionId) {
       const { getGuestLists } = await import('@/store/guest-store');
       recentLists = getGuestLists(guestSessionId).slice(0, 3);
       stats.savedLists = recentLists.length;
     }
     userName = "Guest";
  }

  return (
    <PageContainer>
      <header className="flex items-center bg-white dark:bg-background-dark/50 p-4 sticky top-0 z-50 backdrop-blur-md border-b border-primary/10">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="material-symbols-outlined">shopping_basket</span>
        </div>
        <h2 className="ml-3 text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1">Carto</h2>
        <div className="flex items-center gap-2">
          <button className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-[24px]">notifications</span>
          </button>
        </div>
      </header>

      <div className="flex-1 pb-32">
        <section className="p-4 pt-6">
          <div className="flex w-full items-center gap-4">
            <div className="relative">
              <div className="bg-slate-200 dark:bg-slate-800 rounded-full size-16 ring-4 ring-primary/20 flex items-center justify-center overflow-hidden">
                <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
              </div>
              <div className="absolute bottom-0 right-0 size-4 bg-green-500 border-2 border-white dark:border-background-dark rounded-full"></div>
            </div>
            <div className="flex flex-col">
              <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight">Welcome back, {userName}!</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Ready for your next shopping trip?</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 px-4 py-2">
          <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-primary/5 flex flex-col gap-1 shadow-sm">
            <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
            <p className="text-2xl font-bold mt-1">{stats.totalOrders}</p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Orders</p>
          </div>
          <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-primary/5 flex flex-col gap-1 shadow-sm">
            <span className="material-symbols-outlined text-primary text-xl">favorite</span>
            <p className="text-2xl font-bold mt-1">{stats.savedLists}</p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Saved Lists</p>
          </div>
        </section>

        <section className="px-4 py-4">
          <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/lists/new" className="relative h-28 rounded-xl overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80"></div>
              <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '12px 12px'}}></div>
              <div className="relative h-full flex flex-col justify-between p-4 text-white">
                <span className="material-symbols-outlined text-2xl">add_circle</span>
                <p className="font-bold leading-tight">Create New List</p>
              </div>
            </Link>
            <Link href="/session/start" className="relative h-28 rounded-xl overflow-hidden group cursor-pointer border border-primary/20 bg-white dark:bg-slate-800">
              <div className="h-full flex flex-col justify-between p-4">
                <span className="material-symbols-outlined text-primary text-2xl">qr_code_scanner</span>
                <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight">Scan QR Code</p>
              </div>
            </Link>
          </div>
        </section>

        <section className="px-4 py-2">
          <Link href="/session/start" className="bg-slate-900 dark:bg-primary p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-primary/20 transition-transform active:scale-95">
            <div className="flex flex-col gap-1">
              <h4 className="text-white text-xl font-bold">Start Shopping</h4>
              <p className="text-white/70 text-sm">Activate your smart cart now</p>
            </div>
            <div className="size-14 rounded-full bg-white flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl font-bold">play_arrow</span>
            </div>
          </Link>
        </section>

        <section className="py-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Recent Lists</h3>
            <Link href="/lists" className="text-primary text-sm font-semibold">View All</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar">
            {recentLists.length === 0 ? (
              <div className="min-w-[200px] bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <p className="text-slate-400 text-sm">No recent lists</p>
              </div>
            ) : (
              recentLists.map((list) => (
                <Link key={list.id} href={`/lists/${list.id}`} className="min-w-[200px] bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-transform active:scale-95">
                  <div className="flex -space-x-2 mb-4">
                    <div className="size-8 rounded-full border-2 border-white dark:border-slate-700 bg-primary/10 flex items-center justify-center text-primary text-xs">
                      <span className="material-symbols-outlined text-xs">list</span>
                    </div>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{list.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {list.items?.length || 0} items • Updated 2h ago
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </PageContainer>
  );
}
