import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';

export class PollingService {
  /**
   * Fetches the active session for a given cart, optimized for frequent polling.
   * Returns null if there is no active session.
   */
  public static async getActiveSession(cartId: string) {
    const activeSession = await prisma.cartSession.findFirst({
      where: {
        cartId,
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        shoppingList: {
          select: {
            id: true,
            name: true,
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                isCollected: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
        receipt: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            subtotal: true,
            tax: true,
            total: true,
            paidAt: true,
            paymentAttempts: {
              select: {
                id: true,
                status: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
                category: true,
                scannedAt: true,
              },
              orderBy: { scannedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return activeSession;
  }
}
