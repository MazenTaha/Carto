import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
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
    const checkout = await CartDeviceService.checkout(cart.id);

    return applyDeviceApiHeaders(
      request,
      successResponse({
        cartCode: cart.cartCode,
        cartSessionId: checkout.cartSessionId,
        receiptId: checkout.receiptId,
        items: checkout.items,
        subtotal: checkout.subtotal,
        tax: checkout.tax,
        total: checkout.total,
        paymentStatus: checkout.paymentStatus,
        note: 'Mock device checkout only. Replace with real payment confirmation before production use.',
      }),
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
