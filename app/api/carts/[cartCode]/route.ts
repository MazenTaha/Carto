// Cart lookup by QR code (cartCode)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/carts/[cartCode] - Look up a physical cart by its QR code
export async function GET(
    request: NextRequest,
    { params }: { params: { cartCode: string } }
) {
    try {
        const cart = await prisma.cart.findUnique({
            where: { cartCode: params.cartCode },
            include: {
                store: true,
            },
        });

        if (!cart) {
            return NextResponse.json(
                { error: 'Cart not found. Please scan a valid QR code.' },
                { status: 404 }
            );
        }

        if (cart.status === 'MAINTENANCE' || cart.status === 'OFFLINE') {
            return NextResponse.json(
                { error: `Cart is currently ${cart.status.toLowerCase()}. Please try another cart.` },
                { status: 400 }
            );
        }

        const safeCart = { ...cart, pairingCode: undefined, deviceSecret: undefined };

        return NextResponse.json({ success: true, data: safeCart });
    } catch (error) {
        console.error('Error looking up cart:', error);
        return NextResponse.json(
            { error: 'Failed to look up cart' },
            { status: 500 }
        );
    }
}
