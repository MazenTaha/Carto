import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

const patchSchema = z.object({
  action: z.enum(['reset', 'set_status', 'assign_secret']),
  status: z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE']).optional(),
  deviceSecret: z.string().min(1).max(100).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    await CartConnectionService.reconcileCartById(params.cartId);

    const cart = await prisma.cart.findUnique({
      where: { id: params.cartId },
      include: {
        store: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            user: { select: { email: true, name: true } },
            shoppingList: { select: { name: true, items: { select: { id: true } } } },
            receipt: { select: { total: true, status: true } },
          },
        },
      },
    });

    if (!cart) {
      return errorResponse('Cart not found.', 404, 'NOT_FOUND');
    }

    return successResponse(cart);
  } catch (error: any) {
    console.error('[admin/carts/[cartId] GET]', error);
    return errorResponse('Failed to fetch cart.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const { action, status, deviceSecret } = parsed.data;

    if (action === 'reset') {
      const result = await CartSessionService.resetCartById(params.cartId);
      return successResponse(result);
    }

    if (action === 'set_status' && status) {
      const cart = await prisma.cart.update({
        where: { id: params.cartId },
        data: { status },
      });
      return successResponse(cart);
    }

    if (action === 'assign_secret' && deviceSecret) {
      const cart = await prisma.cart.update({
        where: { id: params.cartId },
        data: { deviceSecret },
      });
      return successResponse(cart);
    }

    return errorResponse('Invalid action or missing parameters.', 400, 'VALIDATION_ERROR');
  } catch (error: any) {
    console.error('[admin/carts/[cartId] PATCH]', error);
    return errorResponse('Failed to update cart.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { cartId: string } }
) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: params.cartId },
      select: { cartCode: true },
    });

    if (!cart) {
      return errorResponse('Cart not found.', 404, 'NOT_FOUND');
    }

    const qrPayload = await CartPairingService.generatePairingQr(cart.cartCode);
    const qrDataUrl = await QRCode.toDataURL(qrPayload.qrValue, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
    });

    return successResponse({
      qrDataUrl,
      pairingCode: qrPayload.payload.pairingCode,
      expiresAt: qrPayload.expiresAt,
      payload: qrPayload.payload,
    });
  } catch (error: any) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('[admin/carts/[cartId] POST]', error);
    return errorResponse('Failed to generate QR.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
