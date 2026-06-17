// User favorite products API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { withNoStoreHeaders } from '@/lib/http-cache';
import { prisma } from '@/lib/prisma';
import { addFavoriteSchema } from '@/lib/validations';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/users/favorites - List user's favorite products
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const favorites = await prisma.userFavoriteProduct.findMany({
            where: { userId: session.user.id },
            include: { product: true },
            orderBy: { purchaseCount: 'desc' },
        });

        return withNoStoreHeaders(NextResponse.json({ success: true, data: favorites }));
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to fetch favorites' },
                { status: 500 }
            )
        );
    }
}

// POST /api/users/favorites - Add or increment a favorite product
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const body = await request.json();
        const { productId } = addFavoriteSchema.parse(body);

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Product not found' }, { status: 404 }));
        }

        // Upsert: create or increment
        const favorite = await prisma.userFavoriteProduct.upsert({
            where: {
                userId_productId: {
                    userId: session.user.id,
                    productId,
                },
            },
            update: {
                purchaseCount: { increment: 1 },
                lastPurchased: new Date(),
            },
            create: {
                userId: session.user.id,
                productId,
                purchaseCount: 1,
            },
            include: { product: true },
        });

        return withNoStoreHeaders(NextResponse.json({ success: true, data: favorite }, { status: 201 }));
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return withNoStoreHeaders(
                NextResponse.json(
                    { error: error.errors[0].message },
                    { status: 400 }
                )
            );
        }

        console.error('Error adding favorite:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to add favorite' },
                { status: 500 }
            )
        );
    }
}

// DELETE /api/users/favorites - Remove a favorite product
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Product ID is required' }, { status: 400 }));
        }

        await prisma.userFavoriteProduct.deleteMany({
            where: {
                userId: session.user.id,
                productId,
            },
        });

        return withNoStoreHeaders(NextResponse.json({ success: true }));
    } catch (error) {
        console.error('Error removing favorite:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to remove favorite' },
                { status: 500 }
            )
        );
    }
}
