import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartPairingService } from '@/lib/services/cart-pairing.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['GET']);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const data = await CartPairingService.generatePairingQr(cart.cartCode);
    return applyDeviceApiHeaders(request, successResponse(data), ['GET', 'OPTIONS']);
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(request, errorResponse(error.message, error.statusCode, error.code), ['GET', 'OPTIONS']);
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('carts/[cartCode]/qrcode GET', error);
      return applyDeviceApiHeaders(request, errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE'), ['GET', 'OPTIONS']);
    }

    console.error('Error generating QR payload:', { message: 'Unexpected device QR failure.' });
    return applyDeviceApiHeaders(request, errorResponse('Failed to generate QR payload.', 500, 'INTERNAL_SERVER_ERROR'), ['GET', 'OPTIONS']);
  }
}
