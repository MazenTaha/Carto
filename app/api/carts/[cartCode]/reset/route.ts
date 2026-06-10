import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { guardAdminApi } from '@/lib/admin-auth';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { CartSessionService } from '@/lib/services/cart-session.service';

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
    if (process.env.NODE_ENV === 'production') {
      const guard = await guardAdminApi(request);
      if (guard) return guard;
    }

    const result = await CartSessionService.resetCartByCode(params.cartCode);

    return setNoStoreHeaders(
      successResponse({
        cartCode: result.cartCode,
        status: result.status,
        closedSessionId: result.closedSessionId,
      })
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error resetting cart:', error);
    return errorResponse('Failed to reset cart.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
