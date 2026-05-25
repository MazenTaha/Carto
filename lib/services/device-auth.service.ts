import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiErrorResponse } from '../api-response';

export class DeviceAuthService {
  /**
   * Extracts the Bearer token from the authorization header.
   */
  public static getBearerToken(request: NextRequest): string | null {
    const authorization = request.headers.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : null;
  }

  /**
   * Verifies that the request contains a valid device secret for the given cart code.
   * Updates the lastSeen timestamp of the cart if successful.
   * Returns the authenticated Cart record.
   */
  public static async authenticateDevice(request: NextRequest, cartCode: string) {
    const deviceSecret = this.getBearerToken(request);

    if (!deviceSecret) {
      throw new ApiErrorResponse('Missing device bearer token.', 401, 'DEVICE_SECRET_REQUIRED');
    }

    const cart = await prisma.cart.findUnique({
      where: { cartCode: cartCode.trim() },
      select: {
        id: true,
        cartCode: true,
        status: true,
        deviceSecret: true,
      },
    });

    if (!cart) {
      throw new ApiErrorResponse('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    if (!cart.deviceSecret || cart.deviceSecret !== deviceSecret) {
      throw new ApiErrorResponse('Invalid device secret.', 401, 'INVALID_DEVICE_SECRET');
    }

    prisma.cart.update({
      where: { id: cart.id },
      data: { lastSeen: new Date() },
    }).catch((err: any) => console.error('Failed to update cart lastSeen:', err));

    return cart;
  }
}
