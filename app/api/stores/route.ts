// Stores API route

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = "nodejs";

// GET /api/stores - List all stores
export async function GET(request: NextRequest) {
    try {
        const stores = await prisma.store.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { carts: true } },
            },
        });

        return NextResponse.json({ success: true, data: stores });
    } catch (error) {
        console.error('Error fetching stores:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stores' },
            { status: 500 }
        );
    }
}
