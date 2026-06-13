import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['POST']);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    await DeviceAuthService.authenticateDevice(request, params.cartCode);

    return applyDeviceApiHeaders(
      request,
      errorResponse(
        'Device-side checkout is disabled. Payments must be completed from the customer Carto checkout flow after Paymob confirmation.',
        409,
        'CUSTOMER_PAYMENT_REQUIRED'
      ),
      ['POST', 'OPTIONS']
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(request, errorResponse(error.message, error.statusCode, error.code), ['POST', 'OPTIONS']);
    }

    console.error('Error checking out cart session:', error);
    return applyDeviceApiHeaders(request, errorResponse('Failed to checkout cart session.', 500, 'INTERNAL_SERVER_ERROR'), ['POST', 'OPTIONS']);
  }
}
