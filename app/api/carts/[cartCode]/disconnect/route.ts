import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['POST']);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const result = await CartSessionService.resetCartById(cart.id);

    return applyDeviceApiHeaders(
      request,
      successResponse({
        cartCode: result.cartCode,
        cartStatus: result.status,
        activeSessionReleased: Boolean(result.closedSessionId),
      }),
      ['POST', 'OPTIONS']
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(request, errorResponse(error.message, error.statusCode, error.code), ['POST', 'OPTIONS']);
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('carts/[cartCode]/disconnect POST', error);
      return applyDeviceApiHeaders(request, errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE'), ['POST', 'OPTIONS']);
    }

    console.error('Error disconnecting cart device:', { message: 'Unexpected device disconnect failure.' });
    return applyDeviceApiHeaders(request, errorResponse('Failed to disconnect cart.', 500, 'INTERNAL_SERVER_ERROR'), ['POST', 'OPTIONS']);
  }
}
