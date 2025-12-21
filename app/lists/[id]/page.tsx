// Individual shopping list detail page

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { getGuestList } from '@/store/guest-store';
import { Sidebar } from '@/components/layout/Sidebar';
import { ListItemsManager } from '@/components/lists/ListItemsManager';
import { EditableListTitle } from '@/components/lists/EditableListTitle';

export default async function ListDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const guestMode = cookieStore.get('guest_mode')?.value === 'true';

  // Allow guests or logged-in users
  if (!session && !guestMode) {
    redirect('/auth/signin');
  }

  let list: any = null;

  if (session) {
    // Logged-in users: fetch from database
    list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        items: true,
      },
    });
  } else if (guestMode) {
    // Guests: fetch from in-memory store
    const guestSessionId = cookieStore.get('guest_session_id')?.value;
    if (guestSessionId) {
      list = getGuestList(guestSessionId, params.id);
      // Items are already in order from the store
    }
  }

  if (!list) {
    redirect('/lists');
  }

  const hasItems = (list.items || []).length > 0;

  return (
    <div className="min-h-screen bg-gray-800 flex">
      <Sidebar />
      <main className="flex-1 ml-64 bg-gray-800 min-h-screen">
        {/* Header with editable title and icons */}
        <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Home Button */}
              <a
                href="/lists"
                className="text-gray-400 hover:text-white transition-colors"
                title="Back to lists"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </a>
              <EditableListTitle initialName={list.name} listId={list.id} />
            </div>
            <div className="flex items-center gap-4">
              {/* Search Icon */}
              <button className="text-gray-400 hover:text-white transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
              {/* User Icon */}
              <button className="text-gray-400 hover:text-white transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
              {/* More Options Icon */}
              <button className="text-gray-400 hover:text-white transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="px-8 py-12">
          <div className="max-w-4xl">
            <ListItemsManager listId={list.id} initialItems={list.items || []} />
          </div>
        </div>
      </main>
    </div>
  );
}

