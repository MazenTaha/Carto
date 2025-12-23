// Dashboard page - main landing page after login

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Navbar } from '@/components/layout/Navbar';
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

  if (session && session.user?.id && !isGuestMode && process.env.DATABASE_URL) {
    try {
      // Lazy import Prisma only when needed
      const { prisma } = await import('@/lib/prisma');
      [lists, activeSession] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { userId: session.user.id },
          include: {
            items: true,
            _count: { select: { items: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
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
      ]);
    } catch (error: any) {
      // Database not available, use empty arrays
      console.log('Database not available:', error?.message || 'Unknown error');
      lists = [];
      activeSession = null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isGuestMode
              ? 'Welcome!'
              : `Welcome back${session?.user?.name ? `, ${session.user.name}` : ''}!`}
          </h1>
          <p className="mt-2 text-gray-600">
            {isGuestMode
              ? 'You are in guest mode. Create an account to save your data.'
              : 'Manage your shopping lists and track your smart cart sessions'}
          </p>
          {isGuestMode && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              <strong>Guest Mode:</strong> Some features may be limited without a database connection.
            </div>
          )}
        </div>

        {activeSession && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Active Shopping Session
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Cart ID: {activeSession.cartId} • Status: {activeSession.status}
                </p>
              </div>
              <Link href="/session">
                <Button>View Session</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-6">
              <Link href="/lists/new">
                <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2 group">
                  <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New List
                </button>
              </Link>
              <Link href="/lists">
                <button className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2 group border border-gray-700">
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View All Lists
                </button>
              </Link>
              {!activeSession && (
                <Link href="/session/start">
                  <button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2 group">
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Start Shopping Session
                  </button>
                </Link>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Lists</h3>
              <Link href="/lists" className="text-sm text-blue-600 hover:text-blue-700">
                View all
              </Link>
            </div>
            {lists.length === 0 ? (
              <p className="text-gray-500 text-sm">No lists yet. Create your first list!</p>
            ) : (
              <ul className="space-y-2">
                {lists.map((list) => (
                  <li key={list.id}>
                    <Link
                      href={`/lists/${list.id}`}
                      className="block p-3 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{list.name}</div>
                      <div className="text-sm text-gray-500">
                        {list._count.items} items • {list.isActive && 'Active'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Lists</span>
                <span className="font-semibold text-gray-900">{lists.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Session</span>
                <span className="font-semibold text-gray-900">
                  {activeSession ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
