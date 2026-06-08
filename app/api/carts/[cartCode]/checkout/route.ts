import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
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
    const checkout = await CartDeviceService.checkout(cart.id);

    return setNoStoreHeaders(
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
      })
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error checking out cart session:', error);
    return errorResponse('Failed to checkout cart session.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
