import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { PollingService } from '@/lib/services/polling.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

export const dynamic = 'force-dynamic';

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

    const response = successResponse(responseData);
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

    console.error('Error fetching device active session:', error);
    return errorResponse('Failed to fetch active session', 500, 'INTERNAL_SERVER_ERROR');
  }
}
