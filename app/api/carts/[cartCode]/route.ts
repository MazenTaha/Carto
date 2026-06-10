import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import { CartConnectionService } from '@/lib/services/cart-connection.service';

// GET /api/carts/[cartCode] - Look up a physical cart by its QR code
export async function GET(
    request: NextRequest,
    { params }: { params: { cartCode: string } }
) {
    try {
        await CartConnectionService.reconcileCartByCode(params.cartCode);

        const cart = await prisma.cart.findUnique({
            where: { cartCode: params.cartCode },
            select: {
                id: true,
                cartCode: true,
                bluetoothName: true,
                status: true,
                lastSeen: true,
                createdAt: true,
                updatedAt: true,
                store: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        currency: true,
                        taxRate: true,
                        logo: true,
                    },
                },
            },
        });

        if (!cart) {
            return errorResponse('Cart not found. Please scan a valid QR code.', 404, 'CART_NOT_FOUND');
        }

        if (cart.status === 'MAINTENANCE' || cart.status === 'OFFLINE') {
            return errorResponse(
                `Cart is currently ${cart.status.toLowerCase()}. Please try another cart.`,
                409,
                `CART_${cart.status}`
            );
        }

        const response = successResponse(cart);
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    } catch (error) {
        console.error('Error looking up cart:', error);
        return errorResponse('Failed to look up cart', 500, 'INTERNAL_SERVER_ERROR');
    }
}
