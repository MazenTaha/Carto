import { NextRequest, NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/sessions
export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'));
  const skip = (page - 1) * pageSize;

  try {
    const where: any = statusFilter
      ? { status: statusFilter }
      : { status: { in: ['ACTIVE', 'DISCONNECTED', 'CHECKED_OUT', 'COMPLETED'] } };

    const [sessions, total] = await Promise.all([
      prisma.cartSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { email: true, name: true, image: true } },
          cart: { select: { cartCode: true } },
          shoppingList: {
            select: {
              name: true,
              items: { select: { id: true, isCollected: true } },
            },
          },
          receipt: { select: { total: true, status: true, paymentStatus: true } },
        },
      }),
      prisma.cartSession.count({ where }),
    ]);

    const data = sessions.map((s) => {
      const started = s.startedAt.getTime();
      const ended = s.endedAt ? s.endedAt.getTime() : Date.now();
      return {
        id: s.id,
        cartCode: s.cart.cartCode,
        cartId: s.cartId,
        userId: s.userId,
        userEmail: s.user?.email ?? null,
        userName: s.user?.name ?? null,
        userImage: s.user?.image ?? null,
        guestSessionId: s.guestSessionId ?? null,
        listName: s.shoppingList.name,
        itemCount: s.shoppingList.items.length,
        collectedCount: s.shoppingList.items.filter((i) => i.isCollected).length,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        durationSeconds: Math.floor((ended - started) / 1000),
        total: s.receipt?.total ?? 0,
        receiptStatus: s.receipt?.status ?? null,
        paymentStatus: s.receipt?.paymentStatus ?? null,
      };
    });

    return NextResponse.json({ success: true, data, total, page, pageSize });
  } catch (error: any) {
    console.error('[admin/sessions GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// PATCH /api/admin/sessions — force-end a session
export async function PATCH(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 });
    }

    const session = await prisma.cartSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    await prisma.cart.update({
      where: { id: session.cartId },
      data: { status: 'AVAILABLE', qrSessionId: null },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    console.error('[admin/sessions PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to end session' }, { status: 500 });
  }
}
