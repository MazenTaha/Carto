import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { PollingService } from '@/lib/services/polling.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';
import { CartConnectionService } from '@/lib/services/cart-connection.service';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['GET']);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const reconciliation = await CartConnectionService.reconcileCartById(cart.id);
    const activeSession = await PollingService.getActiveSession(cart.id);
    const cartStatus = reconciliation?.cart.status ?? cart.status;

    const responseData = activeSession
      ? CartDeviceService.buildActivePayload(
          {
            cartCode: cart.cartCode,
            status: cartStatus,
          },
          activeSession
        )
      : CartDeviceService.buildWaitingPayload({
          cartCode: cart.cartCode,
          status: cartStatus,
        });

    return applyDeviceApiHeaders(request, successResponse(responseData), ['GET', 'OPTIONS']);
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(request, errorResponse(error.message, error.statusCode, error.code), ['GET', 'OPTIONS']);
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('carts/[cartCode]/active-session GET', error);
      return applyDeviceApiHeaders(request, errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE'), ['GET', 'OPTIONS']);
    }

    console.error('Error fetching device active session:', { message: 'Unexpected device active-session failure.' });
    return applyDeviceApiHeaders(request, errorResponse('Failed to fetch active session', 500, 'INTERNAL_SERVER_ERROR'), ['GET', 'OPTIONS']);
  }
}
