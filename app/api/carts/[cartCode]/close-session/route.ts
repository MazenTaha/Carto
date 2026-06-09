import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['POST']);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const activeSession = await CartDeviceService.getActiveSession(cart.id);

    if (!activeSession) {
      return applyDeviceApiHeaders(
        request,
        successResponse({
          cartCode: cart.cartCode,
          sessionClosed: false,
          status: 'waiting',
        }),
        ['POST', 'OPTIONS']
      );
    }

    const result = await CartSessionService.forceFinishSession(activeSession.id);

    return applyDeviceApiHeaders(
      request,
      successResponse({
        cartCode: cart.cartCode,
        cartSessionId: activeSession.id,
        receiptId: result.receiptId,
        status: result.status,
        alreadyFinished: result.alreadyFinished,
        sessionClosed: true,
      }),
      ['POST', 'OPTIONS']
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(request, errorResponse(error.message, error.statusCode, error.code), ['POST', 'OPTIONS']);
    }

    console.error('Error closing cart session:', error);
    return applyDeviceApiHeaders(request, errorResponse('Failed to close cart session.', 500, 'INTERNAL_SERVER_ERROR'), ['POST', 'OPTIONS']);
  }
}
