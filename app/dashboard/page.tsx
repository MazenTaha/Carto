import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  let stats = { totalSpent: 0, savedLists: 0 };
  let recentLists: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; isCollected: boolean }>;
  }> = [];
  const isGuest = owner.type === 'guest';
  let userName = 'there';
  let activeSession = null as Awaited<ReturnType<typeof getOwnedActiveCartSession>>;

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const ownerFilter = ownerWhere(owner);
      await purgeExpiredShoppingLists(prisma, ownerFilter);
      const [listsData, savedListsCount, receiptTotals, activeSessionData, userData] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { ...ownerFilter, deletedAt: null, items: { some: {} } },
          orderBy: { updatedAt: 'desc' },
          take: 4,
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
                isCollected: true,
              },
            },
          },
        }),
        prisma.shoppingList.count({ where: { ...ownerFilter, deletedAt: null, items: { some: {} } } }),
        prisma.receipt.aggregate({
          where: {
            ...ownerFilter,
            status: 'PAID',
          },
          _sum: { total: true },
        }),
        getOwnedActiveCartSession(owner),
        owner.type === 'user'
          ? prisma.user.findUnique({
              where: { id: owner.userId },
              select: { name: true, email: true },
            })
          : Promise.resolve(null),
      ]);

      recentLists = listsData.map((list) => ({
        id: list.id,
        name: list.name,
        items: list.items.map((item) => ({
          id: item.id,
          isCollected: item.isCollected,
        })),
      }));
      stats.savedLists = savedListsCount;
      stats.totalSpent = receiptTotals._sum.total || 0;
      activeSession = activeSessionData;
      if (userData) {
        const emailPrefix = userData.email?.split('@')[0]?.trim();
        userName = userData.name?.trim() || emailPrefix || 'there';
      }
    } catch (error) {}
  }

  return (
    <PageContainer maxWidth="lg">
      <DashboardPageClient
        isGuest={isGuest}
        userName={userName}
        stats={stats}
        recentLists={recentLists}
        initialActiveSession={activeSession}
      />
    </PageContainer>
  );
}
