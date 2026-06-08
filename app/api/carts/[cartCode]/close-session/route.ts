import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { CartSessionService } from '@/lib/services/cart-session.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';

function setNoStoreHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const activeSession = await CartDeviceService.getActiveSession(cart.id);

    if (!activeSession) {
      return setNoStoreHeaders(
        successResponse({
          cartCode: cart.cartCode,
          sessionClosed: false,
          status: 'waiting',
        })
      );
    }

    const result = await CartSessionService.forceFinishSession(activeSession.id);

    return setNoStoreHeaders(
      successResponse({
        cartCode: cart.cartCode,
        cartSessionId: activeSession.id,
        receiptId: result.receiptId,
        status: result.status,
        alreadyFinished: result.alreadyFinished,
        sessionClosed: true,
      })
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error closing cart session:', error);
    return errorResponse('Failed to close cart session.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
