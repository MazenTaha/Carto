import { NextRequest } from 'next/server';
import { z } from 'zod';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';

const addCartItemSchema = z.object({
  productId: z.string().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().positive().default(1),
  category: z.string().trim().max(100).optional(),
}).refine((value) => Boolean(value.productId || value.name), {
  message: 'Provide a productId or product name.',
  path: ['name'],
});

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON');
    }

    const parsed = addCartItemSchema.parse(body);
    const session = await CartDeviceService.addReceiptItem(cart.id, parsed);

    return setNoStoreHeaders(
      successResponse(
        CartDeviceService.buildActivePayload(
          {
            cartCode: cart.cartCode,
            status: 'IN_USE',
          },
          session
        )
      )
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0]?.message || 'Invalid item payload.', 400, 'VALIDATION_ERROR');
    }

    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error adding cart item:', error);
    return errorResponse('Failed to add cart item.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
