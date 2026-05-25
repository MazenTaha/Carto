import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const data = await CartPairingService.generatePairingQr(cart.cartCode);
    const response = successResponse(data);

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      return errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE');
    }

    console.error('Error generating QR payload:', error);
    return errorResponse('Failed to generate QR payload.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
