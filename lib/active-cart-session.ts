import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import type { RequestOwner } from '@/lib/guest-session';
import { ownerWhere } from '@/lib/guest-session';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

export type ActiveCartSessionSummary = {
  sessionId: string;
  status: string;
  cartCode: string;
  cartStatus: string;
  receiptId: string | null;
  shoppingList: {
    id: string;
    name: string;
    itemsCount: number;
  };
};

export async function getOwnedActiveCartSession(owner: RequestOwner): Promise<ActiveCartSessionSummary | null> {
  let cartSession = await prisma.cartSession.findFirst({
    where: {
      ...ownerWhere(owner),
      status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
      endedAt: null,
    },
    select: {
      id: true,
      status: true,
      cart: {
        select: {
          cartCode: true,
          status: true,
        },
      },
      receipt: {
        select: {
          id: true,
        },
      },
      shoppingList: {
        select: {
          id: true,
          name: true,
          items: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!cartSession?.cart?.cartCode) {
    return null;
  }

  const reconciliation = await CartConnectionService.reconcileCartByCode(cartSession.cart.cartCode);

  if (reconciliation?.activeSessionClosed) {
    return null;
  }

  if (reconciliation?.cart) {
    cartSession = {
      ...cartSession,
      cart: {
        ...cartSession.cart,
        status: reconciliation.cart.status,
      },
    };
  }

  if (!cartSession.shoppingList) {
    return null;
  }

  return {
    sessionId: cartSession.id,
    status: cartSession.status,
    cartCode: cartSession.cart.cartCode,
    cartStatus: cartSession.cart.status,
    receiptId: cartSession.receipt?.id ?? null,
    shoppingList: {
      id: cartSession.shoppingList.id,
      name: cartSession.shoppingList.name,
      itemsCount: cartSession.shoppingList.items.length,
    },
  };
}
