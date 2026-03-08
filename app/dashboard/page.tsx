// Dashboard page - main landing page after login

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default async function DashboardPage() {
  let session = null;

  // Check for guest mode first (before any imports that might fail)
  const cookieStore = await cookies();
  const guestModeCookie = cookieStore.get('guest_mode');
  const isGuestMode = guestModeCookie?.value === 'true';

  // Only try to get session if not in guest mode and env vars are set
  if (!isGuestMode && process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    try {
      // Lazy import to avoid loading if not needed
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth-config');
      session = await getServerSession(authOptions);
    } catch (error: any) {
      // NextAuth might fail if database is not configured or secret is missing
      // This is expected in guest mode, so we silently continue
      console.log('Session check skipped:', error?.message || 'Unknown error');
    }
  }

  if (!session && !isGuestMode) {
    redirect('/auth/signin');
  }

  // Get user's lists and active session (only if not guest mode)
  let lists: any[] = [];
  let activeSession: any = null;
  let totalListsCount = 0;
  let stats = { totalSpent: 0, totalOrders: 0 };

  if (session && session.user?.id && !isGuestMode && process.env.DATABASE_URL) {
    try {
      // Lazy import Prisma only when needed
      const { prisma } = await import('@/lib/prisma');
      const [listsData, totalCount, activeSessionData, userStats] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { userId: session.user.id },
          include: {
            items: true,
            _count: { select: { items: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        prisma.shoppingList.count({
          where: { userId: session.user.id },
        }),
        prisma.cartSession.findFirst({
          where: {
            userId: session.user.id,
            status: { in: ['ACTIVE', 'DISCONNECTED'] },
          },
          include: {
            shoppingList: {
              include: { items: true },
            },
          },
        }),
        prisma.userStats.findUnique({
          where: { userId: session.user.id }
        })
      ]);
      lists = listsData;
      totalListsCount = totalCount;
      activeSession = activeSessionData;
      if (userStats) {
        stats = {
          totalSpent: userStats.totalSpent,
          totalOrders: userStats.totalOrders
        };
      }
    } catch (error: any) {
      // Database not available, use empty arrays
      console.log('Database not available:', error?.message || 'Unknown error');
      lists = [];
      totalListsCount = 0;
      activeSession = null;
    }
  } else if (isGuestMode) {
    // For guest mode, get lists from in-memory store
    const guestSessionId = cookieStore.get('guest_session_id')?.value;
    if (guestSessionId) {
      const { getGuestLists } = await import('@/store/guest-store');
      const guestLists = getGuestLists(guestSessionId);
      lists = guestLists.slice(0, 5).map(list => ({
        ...list,
        _count: { items: list.items?.length || 0 },
      }));
      totalListsCount = guestLists.length;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            {isGuestMode
              ? 'Welcome!'
              : `Welcome back${session?.user?.name ? `, ${session.user.name}` : ''}!`}
          </h1>
          <p className="mt-2 text-gray-400 text-lg">
            {isGuestMode
              ? 'You are in guest mode. Create an account to save your data.'
              : 'Manage your shopping lists and track your smart cart sessions'}
          </p>
          {isGuestMode && (
            <div className="mt-4 bg-yellow-900/30 border border-yellow-700/50 text-yellow-200 px-4 py-3 rounded-xl backdrop-blur-sm">
              <span className="font-bold">Guest Mode:</span> Some features may be limited without a database connection.
            </div>
          )}
        </div>

        {activeSession && (
          <div className="mb-8 p-6 rounded-2xl bg-blue-600/10 border border-blue-500/20 backdrop-blur-md flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">
                Active Shopping Session
              </h3>
              <p className="text-blue-300 mt-1">
                Cart ID: {activeSession.cartId} • Status: {activeSession.status}
              </p>
            </div>
            <Link href="/session">
              <Button className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                View Session
              </Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
            <div className="flex flex-col gap-4">
              <Link href="/lists/new">
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 group">
                  <svg className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New List
                </button>
              </Link>
              <Link href="/lists">
                <button className="w-full bg-gray-700/50 hover:bg-gray-700 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-gray-600/50 flex items-center justify-center gap-3 group">
                  <svg className="w-6 h-6 transition-transform group-hover:translate-x-1 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View All Lists
                </button>
              </Link>
              {!activeSession && (
                <Link href="/session/start">
                  <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 group">
                    <svg className="w-6 h-6 transition-transform group-hover:scale-110 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Start Shopping
                  </button>
                </Link>
              )}
            </div>
          </div>

          <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Recent Lists</h3>
              <Link href="/lists" className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                View all
              </Link>
            </div>
            {lists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-400 text-sm">No lists yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {lists.map((list) => (
                  <li key={list.id}>
                    <Link
                      href={`/lists/${list.id}`}
                      className="group block p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-gray-600/50 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-100 group-hover:text-white text-lg">{list.name}</span>
                        <span className="text-xs font-mono text-gray-500 bg-black/30 px-2 py-1 rounded-md">
                          {list._count.items} items
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {list.isActive && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                          {list.isActive ? 'Active Session' : 'Shopping List'}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Your Stats</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Lists</div>
                  <div className="text-3xl font-bold text-white">{totalListsCount}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Orders</div>
                  <div className="text-3xl font-bold text-emerald-500">{stats.totalOrders}</div>
                </div>
              </div>
              <div className="h-px w-full bg-gray-700/50" />
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Spent</div>
                <div className="text-4xl font-black text-white font-mono tracking-tighter">
                  ${stats.totalSpent.toFixed(2)}
                </div>
              </div>
              <div className="h-px w-full bg-gray-700/50" />
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400 font-bold uppercase tracking-wider">Active Cart</span>
                    <span className={activeSession ? "text-blue-400 font-bold" : "text-gray-600 font-bold"}>
                      {activeSession ? 'CONNECTED' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${activeSession ? 'bg-blue-500 w-full animate-pulse' : 'bg-gray-800 w-0'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
