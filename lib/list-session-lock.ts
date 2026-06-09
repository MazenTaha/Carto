import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';

export const ACTIVE_LIST_LOCK_MESSAGE =
  'This list is active on a cart. Finish the session before editing it.';

export async function isListActiveOnCart(listId: string) {
  const activeSession = await prisma.cartSession.findFirst({
    where: {
      listId,
      status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
      endedAt: null,
    },
    select: { id: true },
  });

  return Boolean(activeSession);
}
