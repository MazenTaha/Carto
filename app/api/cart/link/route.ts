import { NextRequest } from 'next/server';
import { linkCartSchema } from '@/lib/validations';
import { requireUserOrGuest } from '@/lib/guest-session';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const validatedData = linkCartSchema.parse(body);

    // The WebApp sends only the selected list plus the cart QR identity.
    // The backend owns session creation; the Raspberry Pi reads it later via Wi-Fi.
    const sessionData = await CartPairingService.linkCart(owner, {
      cartCode: validatedData.cartCode,
      pairingCode: validatedData.pairingCode,
      listId: validatedData.listId,
    });

    return successResponse(
      {
        id: sessionData.id,
        sessionId: sessionData.id,
        cartCode: sessionData.cartCode,
        message: sessionData.reused ? 'Cart is already linked to this list' : 'Cart linked successfully',
      },
      sessionData.reused ? 200 : 201
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    if (error?.code === 'P2034') {
      return errorResponse('Cart link is being processed. Please try again.', 409, 'CART_LINK_CONFLICT');
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('cart/link POST', error);
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Error linking cart:', { message: 'Unexpected cart link failure.' });
    return errorResponse('Failed to link cart', 500, 'INTERNAL_SERVER_ERROR');
  }
}
