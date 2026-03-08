import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { getGuestLists } from '@/store/guest-store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ListCards } from '@/components/lists/ListCards';

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
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col p-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">My Shopping Lists</h1>
            <p className="text-gray-400 mt-2">Manage and organize your shopping trips</p>
          </div>
          <Link href="/lists/new">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 group transition-all hover:scale-105 active:scale-95">
              <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New List
            </Button>
          </Link>
        </div>

        {lists.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 shadow-2xl p-12 text-center max-w-md w-full">
              <div className="w-20 h-20 bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">No lists found</h2>
              <p className="text-gray-400 mb-8">You haven't created any shopping lists yet. Start by creating your first one!</p>
              <Link href="/lists/new">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20">
                  Create Your First List
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <ListCards lists={lists} />
        )}
      </main>
    </div>
  );
}

