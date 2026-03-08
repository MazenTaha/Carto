// Wishlist item deletion API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

// DELETE /api/wishlist/[itemId] - Remove an item from the wishlist
export async function DELETE(
    request: NextRequest,
    { params }: { params: { itemId: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership: item belongs to user's wishlist
        const item = await prisma.wishlistItem.findFirst({
            where: {
                id: params.itemId,
                wishlist: { userId: session.user.id },
            },
        });

        if (!item) {
            return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
        }

        await prisma.wishlistItem.delete({
            where: { id: params.itemId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing wishlist item:', error);
        return NextResponse.json(
            { error: 'Failed to remove wishlist item' },
            { status: 500 }
        );
    }
}
