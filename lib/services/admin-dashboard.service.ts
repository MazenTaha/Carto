import type { ActivityEvent } from '@/types/admin';
import { prisma } from '@/lib/prisma';

function buildRecentSession(session: any) {
  const started = new Date(session.startedAt).getTime();
  const ended = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();

  return {
    id: session.id,
    cartCode: session.cart.cartCode,
    cartId: session.cart.id,
    userId: session.userId,
    userEmail: session.user?.email ?? null,
    userName: session.user?.name ?? null,
    guestSessionId: session.guestSessionId ?? null,
    listName: session.shoppingList.name,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationSeconds: Math.floor((ended - started) / 1000),
    itemCount: session.shoppingList.items.length,
    total: session.receipt?.total ?? 0,
  };
}

export async function getAdminOverviewData() {
  const [
    totalCarts,
    totalUsers,
    totalGuestSessions,
    totalReceipts,
    activeSessions,
    completedSessions,
    cartsRaw,
    recentSessionsRaw,
    paidReceiptsToday,
    recentPaidReceipts,
  ] = await Promise.all([
    prisma.cart.count(),
    prisma.user.count(),
    prisma.guestSession.count(),
    prisma.receipt.count(),
    prisma.cartSession.count({
      where: {
        status: { in: ['ACTIVE', 'DISCONNECTED'] },
        endedAt: null,
      },
    }),
    prisma.cartSession.count({
      where: {
        status: { in: ['COMPLETED', 'CHECKED_OUT'] },
      },
    }),
    prisma.cart.findMany({
      select: { status: true },
    }),
    prisma.cartSession.findMany({
      where: {
        status: { in: ['ACTIVE', 'DISCONNECTED', 'COMPLETED', 'CHECKED_OUT'] },
      },
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
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      select: { total: true },
    }),
    prisma.receipt.findMany({
      where: {
        status: 'PAID',
        paymentStatus: 'COMPLETED',
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        total: true,
        createdAt: true,
        sessionId: true,
      },
    }),
  ]);

  const cartsByStatus = cartsRaw.reduce(
    (acc, cart) => {
      acc[cart.status] = (acc[cart.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recentSessions = recentSessionsRaw.map(buildRecentSession);
  const todayRevenue = paidReceiptsToday.reduce((sum, receipt) => sum + receipt.total, 0);

  const activityFeed: ActivityEvent[] = [
    ...recentSessions.slice(0, 5).map((session): ActivityEvent => ({
      id: `session-${session.id}`,
      type: session.status === 'ACTIVE' || session.status === 'DISCONNECTED' ? 'session_started' : 'session_ended',
      message:
        session.status === 'ACTIVE' || session.status === 'DISCONNECTED'
          ? `Cart ${session.cartCode} linked${session.userEmail ? ` by ${session.userEmail}` : ' by guest'}`
          : `Session on cart ${session.cartCode} ended`,
      timestamp: session.endedAt ?? session.startedAt,
    })),
    ...recentPaidReceipts.map((receipt): ActivityEvent => ({
      id: `receipt-${receipt.id}`,
      type: 'payment_completed',
      message: `Receipt ${receipt.id.slice(-6).toUpperCase()} paid for $${receipt.total.toFixed(2)}`,
      timestamp: receipt.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  return {
    totalCarts,
    totalUsers,
    totalGuestSessions,
    totalReceipts,
    activeSessions,
    completedSessions,
    todayRevenue,
    cartsAvailable: cartsByStatus.AVAILABLE ?? 0,
    cartsInUse: cartsByStatus.IN_USE ?? 0,
    cartsOffline: cartsByStatus.OFFLINE ?? 0,
    cartsMaintenance: cartsByStatus.MAINTENANCE ?? 0,
    cartsOnline: (cartsByStatus.AVAILABLE ?? 0) + (cartsByStatus.IN_USE ?? 0),
    recentSessions,
    activityFeed,
  };
}
