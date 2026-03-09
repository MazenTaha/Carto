// Redesigned Shopping List detail page following Screen 3

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { getGuestList } from '@/store/guest-store';
import { ListItemsManager } from '@/components/lists/ListItemsManager';
import { ShoppingList } from '@/types';

export default async function ListDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let session = null;
  const cookieStore = await cookies();
  const guestMode = cookieStore.get('guest_mode')?.value === 'true';

  if (!guestMode && process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    try {
      session = await getServerSession(authOptions);
    } catch (e) {}
  }

  if (!session && !guestMode) {
    redirect('/auth/signin');
  }

  let list: ShoppingList | null = null;

  if (session && process.env.DATABASE_URL) {
    list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' }
        },
      },
    }) as ShoppingList | null;
  } else if (guestMode) {
    const guestSessionId = cookieStore.get('guest_session_id')?.value;
    if (guestSessionId) {
      list = getGuestList(guestSessionId, params.id) as ShoppingList | null;
    }
  }

  if (!list) {
    redirect('/lists');
  }

  return (
    <ListItemsManager
      listId={list.id}
      listName={list.name}
      initialItems={list.items || []}
    />
  );
}
