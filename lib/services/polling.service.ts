import { prisma } from '@/lib/prisma';

export class PollingService {
  /**
   * Fetches the active session for a given cart, optimized for frequent polling.
   * Returns null if there is no active session.
   */
  public static async getActiveSession(cartId: string) {
    const activeSession = await prisma.cartSession.findFirst({
      where: {
        cartId,
        status: 'ACTIVE',
        // Check endedAt === null as an extra safety measure, though status should be sufficient
        endedAt: null, 
      },
      select: {
        id: true,
        status: true,
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
            subtotal: true,
            tax: true,
            total: true,
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
