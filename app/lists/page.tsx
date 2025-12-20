// Shopping lists page - list all user's lists

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { getGuestLists } from '@/store/guest-store';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default async function ListsPage() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const guestMode = cookieStore.get('guest_mode')?.value === 'true';

  // Allow guests or logged-in users
  if (!session && !guestMode) {
    redirect('/auth/signin');
  }

  // Fetch lists based on user type
  let lists: any[] = [];
  
  if (session) {
    // Logged-in users: fetch from database
    lists = await prisma.shoppingList.findMany({
      where: { userId: session.user.id },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  } else if (guestMode) {
    // Guests: fetch from in-memory store
    const guestSessionId = cookieStore.get('guest_session_id')?.value;
    if (guestSessionId) {
      const guestLists = getGuestLists(guestSessionId);
      lists = guestLists.map(list => ({
        ...list,
        _count: { items: list.items?.length || 0 },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Shopping Lists</h1>
          <Link href="/lists/new">
            <Button variant="primary">Create New List</Button>
          </Link>
        </div>

        {lists.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">You don't have any shopping lists yet.</p>
              <Link href="/lists/new">
                <Button variant="primary">Create Your First List</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list) => (
              <Card key={list.id} className="hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {list._count.items} items • {list.isActive && 'Active'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Link href={`/lists/${list.id}`} className="flex-1">
                    <Button variant="primary" className="w-full" size="sm">
                      View
                    </Button>
                  </Link>
                  <Link href={`/lists/${list.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

