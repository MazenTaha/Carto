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
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Main Content Area - Centered Card Container */}
        <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-12">
          <ListItemsManager
            listId={list.id}
            listName={list.name}
            initialItems={list.items || []}
          />
        </div>
      </main>
    </div>
  );
}

