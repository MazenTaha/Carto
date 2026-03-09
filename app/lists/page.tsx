// Redesigned Shopping Lists page following Screen 1

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomNav } from '@/components/layout/BottomNav';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingList } from '@/types';

export default async function ListsPage() {
  let session = null;
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
      lists = getGuestLists(guestSessionId).map(l => ({
        ...l,
        _count: { items: l.items?.length || 0 }
      }));
    }
  }

  return (
    <PageContainer maxWidth="2xl">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined">shopping_cart</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Carto</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-primary/5 rounded-full transition-colors">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-primary/5 rounded-full transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex-1 pb-32">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">My Lists</h2>
          <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            {lists.length} Active
          </span>
        </div>

        <div className="space-y-4">
          {lists.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-4xl">list_alt</span>
              </div>
              <p className="text-slate-500 font-medium">No shopping lists yet</p>
              <Link href="/lists/new" className="text-primary font-bold hover:underline">Create your first list</Link>
            </div>
          ) : (
            lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-primary/5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">local_grocery_store</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{list.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">format_list_bulleted</span>
                        {list._count?.items || 0} items
                      </span>
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-slate-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      <Link href="/lists/new" className="fixed bottom-24 right-6 size-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20">
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>

      <BottomNav />
    </PageContainer>
  );
}
