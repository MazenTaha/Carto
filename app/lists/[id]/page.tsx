// Redesigned Shopping List detail page following Screen 3

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ListItemsManager } from '@/components/lists/ListItemsManager';
import { ShoppingList } from '@/types';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { isListActiveOnCart } from '@/lib/list-session-lock';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';

export const dynamic = 'force-dynamic';

export default async function ListDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  let list: ShoppingList | null = null;
  let isLockedForActiveSession = false;
  let activeSession = null as Awaited<ReturnType<typeof getOwnedActiveCartSession>>;

  if (process.env.DATABASE_URL) {
    const ownerFilter = ownerWhere(owner);
    await purgeExpiredShoppingLists(prisma, ownerFilter);
    const [listData, activeSessionData] = await Promise.all([
      prisma.shoppingList.findFirst({
        where: {
          id: params.id,
          ...ownerFilter,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          userId: true,
          guestSessionId: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              price: true,
              category: true,
              isCollected: true,
              collectedAt: true,
              listId: true,
            },
          },
        },
      }) as Promise<ShoppingList | null>,
      getOwnedActiveCartSession(owner),
    ]);
    list = listData;
    activeSession = activeSessionData;

    if (list) {
      isLockedForActiveSession = await isListActiveOnCart(list.id);

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[lists/page]', {
          listId: list.id,
          ownerType: owner.type,
          itemCount: list.items?.length ?? 0,
          isLockedForActiveSession,
        });
      }
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
      isLockedForActiveSession={isLockedForActiveSession}
      activeSession={activeSession}
    />
  );
}
