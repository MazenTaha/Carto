import { NextRequest } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { CartSessionService } from '@/lib/services/cart-session.service';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const skip = (page - 1) * pageSize;

  try {
    await CartSessionService.expireStaleSessions();

    const where = statusFilter
      ? { status: statusFilter as any }
      : { status: { in: [...ACTIVE_CART_SESSION_STATUSES, 'CHECKED_OUT', 'COMPLETED'] as const } };

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

    const data = sessions.map((session) => {
      const started = session.startedAt.getTime();
      const ended = session.endedAt ? session.endedAt.getTime() : Date.now();

      return {
        id: session.id,
        cartCode: session.cart.cartCode,
        cartId: session.cartId,
        userId: session.userId,
        userEmail: session.user?.email ?? null,
        userName: session.user?.name ?? null,
        userImage: session.user?.image ?? null,
        guestSessionId: session.guestSessionId ?? null,
        listName: session.shoppingList.name,
        itemCount: session.shoppingList.items.length,
        collectedCount: session.shoppingList.items.filter((item) => item.isCollected).length,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        durationSeconds: Math.floor((ended - started) / 1000),
        total: session.receipt?.total ?? 0,
        receiptStatus: session.receipt?.status ?? null,
        paymentStatus: session.receipt?.paymentStatus ?? null,
      };
    });

    return successResponse({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('[admin/sessions GET]', error);
    return errorResponse('Failed to fetch sessions.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return errorResponse('sessionId is required.', 400, 'VALIDATION_ERROR');
    }

    const result = await CartSessionService.forceFinishSession(sessionId);
    return successResponse({
      sessionId,
      receiptId: result.receiptId,
      status: result.status,
      alreadyFinished: result.alreadyFinished,
    });
  } catch (error: any) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('[admin/sessions PATCH]', error);
    return errorResponse('Failed to end session.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
