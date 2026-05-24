import { NextRequest } from 'next/server';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';
import { cartQrPayloadSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

const PAIRING_TTL_MINUTES = 5;

function createPairingCode() {
  return String(randomInt(100000, 1000000));
}

function getPairingExpiresAt() {
  return new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);
}

// GET /api/cart/qrcode?cartCode=CART-001
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartCode = searchParams.get('cartCode')?.trim();

    if (!cartCode) {
      return errorResponse('Cart code is required', 400, 'VALIDATION_ERROR');
    }

    const cart = await prisma.cart.findUnique({
      where: { cartCode },
      select: {
        id: true,
        cartCode: true,
        status: true,
      },
    });

    if (!cart) {
      return errorResponse('Cart not found', 404, 'NOT_FOUND');
    }

    if (cart.status !== 'AVAILABLE') {
      return errorResponse(`Cart is currently ${cart.status.toLowerCase()}.`, 409, 'CART_UNAVAILABLE');
    }

    const pairingExpiresAt = getPairingExpiresAt();

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        pairingCode: createPairingCode(),
        pairingExpiresAt,
        qrSessionId: null,
        lastSeen: new Date(),
      },
      select: {
        cartCode: true,
        pairingCode: true,
        pairingExpiresAt: true,
      },
    });

    // The QR identifies only the physical cart and its short-lived pairing token.
    // The backend creates CartSession after scan; the device receives list/receipt data later via polling.
    if (!updatedCart.pairingCode) {
      return errorResponse('Failed to generate pairing code', 500, 'PAIRING_CODE_MISSING');
    }

    const payload = cartQrPayloadSchema.parse({
      type: 'cart_pairing',
      cartCode: updatedCart.cartCode,
      pairingCode: updatedCart.pairingCode,
    });

    const qrValue = JSON.stringify(payload);

    const response = successResponse({
      payload,
      qrValue,
      expiresAt: updatedCart.pairingExpiresAt?.toISOString() ?? pairingExpiresAt.toISOString(),
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0]?.message || 'Invalid QR payload', 400, 'VALIDATION_ERROR');
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Error generating cart QR code:', error);
    return errorResponse('Failed to generate cart QR code', 500, 'INTERNAL_SERVER_ERROR');
  }
}
