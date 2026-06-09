import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { CartDeviceService } from '@/lib/services/cart-device.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

function setNoStoreHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
  ) {
  try {
    const bearerToken = DeviceAuthService.getBearerToken(request);

    if (bearerToken) {
      const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
      const reconciliation = await CartConnectionService.reconcileCartById(cart.id);
      const activeSession = await CartDeviceService.getActiveSession(cart.id);
      const persistedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        select: { lastSeen: true },
      });

      return setNoStoreHeaders(
        successResponse({
          cartCode: cart.cartCode,
          status: activeSession ? 'IN_USE' : reconciliation?.cart.status ?? cart.status,
          activeSessionId: activeSession?.id ?? null,
          receiptId: activeSession?.receipt?.id ?? null,
          hasActiveSession: Boolean(activeSession),
          lastSeen: persistedCart?.lastSeen.toISOString() ?? null,
        })
      );
    }

    const reconciliation = await CartConnectionService.reconcileCartByCode(params.cartCode);
    const cart = await prisma.cart.findUnique({
      where: { cartCode: params.cartCode.trim() },
      select: {
        id: true,
        cartCode: true,
        status: true,
        lastSeen: true,
      },
    });

    if (!cart) {
      return errorResponse('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    const activeSession = await CartDeviceService.getActiveSession(cart.id);

    return setNoStoreHeaders(
      successResponse({
        cartCode: cart.cartCode,
        status: activeSession ? 'IN_USE' : reconciliation?.cart.status ?? cart.status,
        isAvailable: !activeSession && (reconciliation?.cart.status ?? cart.status) === 'AVAILABLE',
        hasActiveSession: Boolean(activeSession),
      })
    );
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Error fetching cart status:', error);
    return errorResponse('Failed to fetch cart status.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
