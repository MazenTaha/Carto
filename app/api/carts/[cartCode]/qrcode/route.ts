import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { successResponse, errorResponse, ApiErrorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    // 1. Authenticate the hardware device using its bearer token.
    // This ensures that only the physical cart itself can request a new QR payload.
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);

    // 2. Generate a secure, short-lived pairing code.
    // We use a 6-digit numeric string for simplicity when typing manually,
    // while still providing a million combinations against random guessing.
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 3. Set expiration time to 5 minutes from now.
    const expiresInMinutes = 5;
    const pairingExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 4. Persist the new pairing parameters to the database.
    // When the mobile app scans the QR and calls POST /api/cart/link, 
    // it will validate against these exact values.
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        pairingCode,
        pairingExpiresAt,
      },
    });

    // 5. Construct the specific QR payload format expected by the Mobile Scanner app.
    // The `type: 'cart_pairing'` field allows the scanner to understand the QR's purpose.
    const payload = {
      type: 'cart_pairing',
      cartCode: cart.cartCode,
      pairingCode: pairingCode,
    };

    const response = successResponse({
      cartCode: cart.cartCode,
      pairingCode: pairingCode,
      expiresInMs: expiresInMinutes * 60 * 1000,
      expiresAt: pairingExpiresAt.toISOString(),
      qrValue: JSON.stringify(payload),
      payload,
    });
    
    // Prevent the device from caching this sensitive payload.
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

    console.error('Error generating QR payload:', error);
    return errorResponse('Failed to generate QR payload', 500, 'INTERNAL_SERVER_ERROR');
  }
}
