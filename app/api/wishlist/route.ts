// Wishlist API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { createWishlistItemSchema } from '@/lib/validations';

// GET /api/wishlist - Get user's wishlist with items
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const wishlist = await prisma.wishlist.findUnique({
            where: { userId: session.user.id },
            include: {
                items: {
                    include: { product: true },
                    orderBy: { addedAt: 'desc' },
                },
            },
        });

        if (!wishlist) {
            return NextResponse.json({ success: true, data: { items: [] } });
        }

        return NextResponse.json({ success: true, data: wishlist });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return NextResponse.json(
            { error: 'Failed to fetch wishlist' },
            { status: 500 }
        );
    }
}

// POST /api/wishlist - Add a product to wishlist (auto-creates wishlist)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { productId, note } = createWishlistItemSchema.parse(body);

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Get or create wishlist
        const wishlist = await prisma.wishlist.upsert({
            where: { userId: session.user.id },
            update: {},
            create: { userId: session.user.id },
        });

        // Check if product is already in wishlist
        const existing = await prisma.wishlistItem.findUnique({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Product is already in your wishlist' },
                { status: 400 }
            );
        }

        const item = await prisma.wishlistItem.create({
            data: {
                wishlistId: wishlist.id,
                productId,
                note: note || null,
            },
            include: { product: true },
        });

        return NextResponse.json({ success: true, data: item }, { status: 201 });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return NextResponse.json(
                { error: error.errors[0].message },
                { status: 400 }
            );
        }

        console.error('Error adding to wishlist:', error);
        return NextResponse.json(
            { error: 'Failed to add to wishlist' },
            { status: 500 }
        );
    }
}
