import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const [totalCarts, totalUsers, cartsRaw, sessionsRaw, receiptsToday] =
      await Promise.all([
        prisma.cart.count(),
        prisma.user.count(),
        prisma.cart.findMany({
          select: { status: true },
        }),
        prisma.cartSession.findMany({
          where: { status: { in: ['ACTIVE', 'DISCONNECTED'] } },
          take: 10,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            userId: true,
            guestSessionId: true,
            cart: { select: { cartCode: true, id: true } },
            user: { select: { email: true, name: true } },
            shoppingList: { select: { name: true, items: { select: { id: true } } } },
            receipt: { select: { total: true } },
          },
        }),
        prisma.receipt.findMany({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
            paymentStatus: 'COMPLETED',
          },
          select: { total: true },
        }),
      ]);

    const cartsByStatus = cartsRaw.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const todayRevenue = receiptsToday.reduce((sum, r) => sum + r.total, 0);

    const recentSessions = sessionsRaw.map((s) => {
      const started = new Date(s.startedAt).getTime();
      const ended = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      return {
        id: s.id,
        cartCode: s.cart.cartCode,
        cartId: s.cart.id,
        userId: s.userId,
        userEmail: s.user?.email ?? null,
        userName: s.user?.name ?? null,
        guestSessionId: s.guestSessionId ?? null,
        listName: s.shoppingList.name,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        durationSeconds: Math.floor((ended - started) / 1000),
        itemCount: s.shoppingList.items.length,
        total: s.receipt?.total ?? 0,
      };
    });

    // Synthetic activity feed from real data
    const activityFeed = recentSessions.slice(0, 5).map((s) => ({
      id: s.id,
      type: s.status === 'ACTIVE' ? 'session_started' : 'session_ended',
      message:
        s.status === 'ACTIVE'
          ? `Cart ${s.cartCode} linked${s.userEmail ? ` by ${s.userEmail}` : ' by guest'}`
          : `Session on cart ${s.cartCode} ended`,
      timestamp: s.startedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalCarts,
        totalUsers,
        activeSessions: sessionsRaw.filter((s) => s.status === 'ACTIVE').length,
        todayRevenue,
        cartsAvailable: cartsByStatus['AVAILABLE'] ?? 0,
        cartsInUse: cartsByStatus['IN_USE'] ?? 0,
        cartsOffline: cartsByStatus['OFFLINE'] ?? 0,
        cartsMaintenance: cartsByStatus['MAINTENANCE'] ?? 0,
        cartsOnline:
          (cartsByStatus['AVAILABLE'] ?? 0) + (cartsByStatus['IN_USE'] ?? 0),
        recentSessions,
        activityFeed,
      },
    });
  } catch (error: any) {
    console.error('[admin/stats]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
