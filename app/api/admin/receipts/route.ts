import { NextRequest } from 'next/server';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const skip = (page - 1) * pageSize;

  try {
    const where = status ? { status: status as any } : {};

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { email: true, name: true } },
          guestSession: { select: { id: true } },
          cartSession: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              endedAt: true,
              cart: { select: { cartCode: true } },
              shoppingList: { select: { name: true } },
            },
          },
          items: {
            select: {
              id: true,
            },
          },
        },
      }),
      prisma.receipt.count({ where }),
    ]);

    return successResponse({
      data: receipts.map((receipt) => ({
        id: receipt.id,
        status: receipt.status,
        paymentStatus: receipt.paymentStatus,
        paymentMethod: receipt.paymentMethod,
        total: receipt.total,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        createdAt: receipt.createdAt.toISOString(),
        lockedAt: receipt.lockedAt?.toISOString() ?? null,
        userEmail: receipt.user?.email ?? null,
        userName: receipt.user?.name ?? null,
        guestSessionId: receipt.guestSession?.id ?? receipt.guestSessionId ?? null,
        sessionId: receipt.sessionId,
        sessionStatus: receipt.cartSession?.status ?? null,
        cartCode: receipt.cartSession?.cart?.cartCode ?? null,
        listName: receipt.cartSession?.shoppingList?.name ?? null,
        itemCount: receipt.items.length,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('[admin/receipts GET]', error);
    return errorResponse('Failed to fetch receipts.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
