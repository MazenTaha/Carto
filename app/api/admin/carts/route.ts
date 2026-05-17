import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const carts = await prisma.cart.findMany({
      orderBy: { lastSeen: 'desc' },
      include: {
        store: { select: { name: true } },
        sessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            userId: true,
            user: { select: { email: true, name: true } },
            shoppingList: { select: { name: true } },
            receipt: { select: { total: true } },
          },
        },
      },
    });

    const data = carts.map((cart) => {
      const activeSession = cart.sessions[0] ?? null;
      // Mock battery: derive from lastSeen age (just for demo)
      const ageMs = Date.now() - cart.lastSeen.getTime();
      const batteryLevel = Math.max(10, Math.min(100, 100 - Math.floor(ageMs / 1000 / 60 / 2)));

      return {
        id: cart.id,
        cartCode: cart.cartCode,
        bluetoothName: cart.bluetoothName,
        deviceSecret: cart.deviceSecret,
        status: cart.status,
        lastSeen: cart.lastSeen.toISOString(),
        createdAt: cart.createdAt.toISOString(),
        storeId: cart.storeId,
        storeName: cart.store.name,
        batteryLevel,
        isOnline: cart.status !== 'OFFLINE',
        currentSession: activeSession
          ? {
              id: activeSession.id,
              cartCode: cart.cartCode,
              cartId: cart.id,
              userId: activeSession.userId,
              userEmail: activeSession.user?.email ?? null,
              userName: activeSession.user?.name ?? null,
              guestSessionId: null,
              listName: activeSession.shoppingList?.name ?? '',
              status: activeSession.status,
              startedAt: activeSession.startedAt.toISOString(),
              endedAt: null,
              total: activeSession.receipt?.total ?? 0,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[admin/carts GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch carts' },
      { status: 500 }
    );
  }
}
