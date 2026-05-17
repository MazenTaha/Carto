import { NextRequest, NextResponse } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { PollingService } from '@/lib/services/polling.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    // 1. Authenticate the hardware device using its bearer token
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);

    // 2. Fetch the active session optimally
    const activeSession = await PollingService.getActiveSession(cart.id);

    // 3. Prepare response ensuring no-cache to guarantee real-time behavior
    const responseData = activeSession 
      ? {
          active: true,
          sessionId: activeSession.id,
          status: activeSession.status,
          cartCode: cart.cartCode,
          list: activeSession.shoppingList,
          receipt: activeSession.receipt,
        }
      : {
          active: false,
          cartCode: cart.cartCode,
          status: cart.status,
        };

    const response = successResponse(responseData);
    
    // Critical: Devices polling must not receive cached data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Error fetching device active session:', error);
    return errorResponse('Failed to fetch active session', 500, 'INTERNAL_SERVER_ERROR');
  }
}
