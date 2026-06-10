import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { successResponse, errorResponse } from '@/lib/api-response';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    await CartSessionService.expireStaleSessions();
    await CartConnectionService.reconcileFleetCarts();

    const carts = await prisma.cart.findMany({
      orderBy: { lastSeen: 'desc' },
      include: {
        store: { select: { name: true } },
        sessions: {
          where: {
            status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
            endedAt: null,
          },
          take: 1,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            userId: true,
            guestSessionId: true,
            user: { select: { email: true, name: true } },
            shoppingList: { select: { name: true } },
            receipt: { select: { total: true } },
          },
        },
      },
    });

    const data = carts.map((cart) => {
      const activeSession = cart.sessions[0] ?? null;

      return {
        id: cart.id,
        cartCode: cart.cartCode,
        bluetoothName: cart.bluetoothName,
        deviceSecret: cart.deviceSecret,
        hasDeviceSecret: Boolean(cart.deviceSecret),
        status: cart.status,
        lastSeen: cart.lastSeen.toISOString(),
        createdAt: cart.createdAt.toISOString(),
        storeId: cart.storeId,
        storeName: cart.store.name,
        isOnline: cart.status !== 'OFFLINE',
        currentSession: activeSession
          ? {
              id: activeSession.id,
              cartCode: cart.cartCode,
              cartId: cart.id,
              userId: activeSession.userId,
              userEmail: activeSession.user?.email ?? null,
              userName: activeSession.user?.name ?? null,
              guestSessionId: activeSession.guestSessionId ?? null,
              listName: activeSession.shoppingList?.name ?? '',
              status: activeSession.status,
              startedAt: activeSession.startedAt.toISOString(),
              endedAt: activeSession.endedAt?.toISOString() ?? null,
              total: activeSession.receipt?.total ?? 0,
            }
          : null,
      };
    });

    return successResponse(data);
  } catch (error: any) {
    console.error('[admin/carts GET]', error);
    return errorResponse('Failed to fetch carts.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
