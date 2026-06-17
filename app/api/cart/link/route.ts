import { NextRequest } from 'next/server';
import { linkCartSchema } from '@/lib/validations';
import { requireUserOrGuest } from '@/lib/guest-session';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { ApiErrorResponse } from '@/lib/api-response';
import { noStoreErrorResponse, noStoreSuccessResponse } from '@/lib/http-cache';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

async function linkCartWithRecovery(
  owner: Awaited<ReturnType<typeof requireUserOrGuest>>,
  input: {
    cartCode: string;
    pairingCode: string;
    listId: string;
  }
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await CartPairingService.linkCart(owner!, input);
    } catch (error: any) {
      if (error?.code !== 'P2034') {
        throw error;
      }

      const existingSession = await CartPairingService.getOwnedExistingLinkedSession(owner!, {
        cartCode: input.cartCode,
        listId: input.listId,
      });

      if (existingSession) {
        return existingSession;
      }

      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error('Failed to recover cart link request.');
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return noStoreErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreErrorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const validatedData = linkCartSchema.parse(body);

    // The WebApp sends only the selected list plus the cart QR identity.
    // The backend owns session creation; the Raspberry Pi reads it later via Wi-Fi.
    const sessionData = await linkCartWithRecovery(owner, {
      cartCode: validatedData.cartCode,
      pairingCode: validatedData.pairingCode,
      listId: validatedData.listId,
    });

    const redirectUrl = `/session/ready?sessionId=${encodeURIComponent(sessionData.id)}`;

    return noStoreSuccessResponse(
      {
        id: sessionData.id,
        cartSessionId: sessionData.id,
        sessionId: sessionData.id,
        receiptId: sessionData.receiptId,
        cartCode: sessionData.cartCode,
        status: sessionData.status,
        alreadyLinked: sessionData.alreadyLinked,
        redirectUrl,
        message: sessionData.reused ? 'Cart is already linked to this list' : 'Cart linked successfully',
      },
      sessionData.reused ? 200 : 201
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return noStoreErrorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error instanceof ApiErrorResponse) {
      return noStoreErrorResponse(error.message, error.statusCode, error.code);
    }

    if (error?.code === 'P2034') {
      return noStoreErrorResponse('We could not confirm the cart link yet. Please tap Send list again.', 409, 'CART_LINK_CONFLICT');
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('cart/link POST', error);
      return noStoreErrorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Error linking cart:', { message: 'Unexpected cart link failure.' });
    return noStoreErrorResponse('Failed to link cart', 500, 'INTERNAL_SERVER_ERROR');
  }
}
