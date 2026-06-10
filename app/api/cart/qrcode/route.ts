import { NextRequest } from 'next/server';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartCode = searchParams.get('cartCode')?.trim();

    if (!cartCode) {
      return errorResponse('Cart code is required.', 400, 'VALIDATION_ERROR');
    }

    const data = await CartPairingService.generatePairingQr(cartCode);
    const response = successResponse(data);

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error: any) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('cart/qrcode GET', error);
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Error generating cart QR code:', { message: 'Unexpected cart QR failure.' });
    return errorResponse('Failed to generate cart QR code.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
