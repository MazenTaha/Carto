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
              ? 'Welcome to Carto!'
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
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/lists/new">
                <Button className="w-full" variant="primary">
                  Create New List
                </Button>
              </Link>
              <Link href="/lists">
                <Button className="w-full" variant="outline">
                  View All Lists
                </Button>
              </Link>
              {!activeSession && (
                <Link href="/session/start">
                  <Button className="w-full" variant="secondary">
                    Start Shopping Session
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Lists</h3>
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
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Lists</span>
                <span className="font-semibold">{lists.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Session</span>
                <span className="font-semibold">
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
