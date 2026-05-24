import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [sessions, receiptItems, carts] = await Promise.all([
      prisma.cartSession.findMany({
        where: { startedAt: { gte: thirtyDaysAgo } },
        select: { startedAt: true, status: true, receipt: { select: { total: true } } },
      }),
      prisma.receiptItem.findMany({
        where: { scannedAt: { gte: thirtyDaysAgo } },
        select: { name: true, category: true, quantity: true, scannedAt: true },
        orderBy: { scannedAt: 'desc' },
        take: 2000,
      }),
      prisma.cart.findMany({ select: { status: true } }),
    ]);

    // Sessions per day
    const sessionsByDay: Record<string, { sessions: number; revenue: number }> = {};
    for (const s of sessions) {
      const day = s.startedAt.toISOString().slice(0, 10);
      if (!sessionsByDay[day]) sessionsByDay[day] = { sessions: 0, revenue: 0 };
      sessionsByDay[day].sessions++;
      sessionsByDay[day].revenue += s.receipt?.total ?? 0;
    }
    const sessionsPerDay = Object.entries(sessionsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Peak hours
    const hourCounts: Record<number, number> = {};
    for (const s of sessions) {
      const h = s.startedAt.getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, '0')}:00`,
      sessions: hourCounts[h] ?? 0,
    }));

    // Top products
    const productCounts: Record<string, { scans: number; category: string }> = {};
    for (const item of receiptItems) {
      if (!productCounts[item.name]) productCounts[item.name] = { scans: 0, category: item.category ?? 'Other' };
      productCounts[item.name].scans += item.quantity;
    }
    const topProducts = Object.entries(productCounts)
      .sort(([, a], [, b]) => b.scans - a.scans)
      .slice(0, 10)
      .map(([name, v]) => ({ name, ...v }));

    // Cart utilization
    const statusCounts: Record<string, number> = {};
    for (const c of carts) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    const COLORS: Record<string, string> = {
      AVAILABLE: '#10b981',
      IN_USE: '#6366f1',
      MAINTENANCE: '#f59e0b',
      OFFLINE: '#ef4444',
    };
    const cartUtilization = Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      fill: COLORS[name] ?? '#94a3b8',
    }));

    const totalRevenue = sessions.reduce(
      (sum: number, session: { receipt: { total: number } | null }) => sum + (session.receipt?.total ?? 0),
      0
    );
    const avgBasketSize = sessions.length > 0 ? totalRevenue / sessions.length : 0;

    return NextResponse.json({
      success: true,
      data: {
        sessionsPerDay,
        peakHours,
        topProducts,
        cartUtilization,
        avgBasketSize: parseFloat(avgBasketSize.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalSessions: sessions.length,
      },
    });
  } catch (error: any) {
    console.error('[admin/analytics GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
