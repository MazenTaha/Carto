// User stats API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/users/stats - Get or create user stats
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Upsert: return existing stats or create new ones
        const stats = await prisma.userStats.upsert({
            where: { userId: session.user.id },
            update: {},
            create: {
                userId: session.user.id,
                totalOrders: 0,
                totalSpent: 0,
                averageBasketValue: 0,
            },
        });

        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user stats' },
            { status: 500 }
        );
    }
}
