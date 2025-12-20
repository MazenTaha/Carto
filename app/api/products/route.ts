
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    try {
        const where = query
            ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { category: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const products = await prisma.product.findMany({
            where,
            orderBy: { popularity: 'desc' },
            take: limit,
        });

        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
