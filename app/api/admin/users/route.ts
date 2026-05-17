import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'));
  const skip = (page - 1) * pageSize;

  try {
    const where: any = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          phoneNumber: true,
          createdAt: true,
          stats: { select: { totalOrders: true, totalSpent: true } },
          _count: { select: { cartSessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      phoneNumber: u.phoneNumber,
      createdAt: u.createdAt.toISOString(),
      totalSessions: u._count.cartSessions,
      totalSpent: u.stats?.totalSpent ?? 0,
      isGuest: false,
    }));

    return NextResponse.json({ success: true, data, total, page, pageSize });
  } catch (error: any) {
    console.error('[admin/users GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const { userId, action } = await req.json();
    if (!userId || !action) {
      return NextResponse.json({ success: false, error: 'userId and action required' }, { status: 400 });
    }

    if (action === 'disable') {
      // End all active sessions for this user
      await prisma.cartSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'DISCONNECTED', endedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'User sessions terminated' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[admin/users PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
