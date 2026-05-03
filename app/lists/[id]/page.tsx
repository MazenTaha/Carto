// Redesigned Shopping List detail page following Screen 3

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ListItemsManager } from '@/components/lists/ListItemsManager';
import { ShoppingList } from '@/types';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { isListActiveOnCart } from '@/lib/list-session-lock';

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

  if (process.env.DATABASE_URL) {
    const ownerFilter = ownerWhere(owner);
    await purgeExpiredShoppingLists(prisma, ownerFilter);
    list = await prisma.shoppingList.findFirst({
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
    }) as ShoppingList | null;

    if (list) {
      isLockedForActiveSession = await isListActiveOnCart(list.id);
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
    />
  );
}
