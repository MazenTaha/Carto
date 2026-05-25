import { NextRequest, NextResponse } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { PollingService } from '@/lib/services/polling.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const activeSession = await PollingService.getActiveSession(cart.id);
    let cartStatus = cart.status;

    if (activeSession && cartStatus !== 'IN_USE') {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { status: 'IN_USE', lastSeen: new Date() },
      });
      cartStatus = 'IN_USE';
    }

    if (!activeSession && cartStatus === 'IN_USE') {
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          status: 'AVAILABLE',
          pairingCode: null,
          pairingExpiresAt: null,
          qrSessionId: null,
          lastSeen: new Date(),
        },
      });
      cartStatus = 'AVAILABLE';
    }

    const responseData = activeSession
      ? {
          active: true,
          cart: {
            cartCode: cart.cartCode,
            status: cartStatus,
          },
          session: {
            id: activeSession.id,
            status: activeSession.status,
            startedAt: activeSession.startedAt,
            endedAt: activeSession.endedAt,
          },
          list: activeSession.shoppingList,
          receipt: activeSession.receipt,
        }
      : {
          active: false,
          cart: {
            cartCode: cart.cartCode,
            status: cartStatus,
          },
        };

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
