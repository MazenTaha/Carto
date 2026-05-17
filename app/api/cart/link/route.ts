import { NextRequest } from 'next/server';
import { linkCartSchema } from '@/lib/validations';
import { requireUserOrGuest } from '@/lib/guest-session';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const validatedData = linkCartSchema.parse(body);

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

    console.error('Error linking cart:', error);
    return errorResponse('Failed to link cart', 500, 'INTERNAL_SERVER_ERROR');
  }
}
