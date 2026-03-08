
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const category = searchParams.get('category');

    try {
        // If no query, return popular products (optionally filtered by category)
        if (!query.trim()) {
            const where: any = {};
            if (category) {
                where.category = { equals: category, mode: 'insensitive' };
            }

            const products = await prisma.product.findMany({
                where,
                orderBy: { popularity: 'desc' },
                take: limit,
            });

            return NextResponse.json({ success: true, data: products });
        }

        // Try trigram similarity search first, fall back to ILIKE if pg_trgm is not available
        try {
            // Enable pg_trgm extension (idempotent)
            await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

            // Build category filter clause
            const categoryFilter = category
                ? `AND category ILIKE '%' || $3 || '%'`
                : '';

            const queryParams = category
                ? [query, limit, category]
                : [query, limit];

            const products = await prisma.$queryRawUnsafe(
                `SELECT *, similarity(name, $1) AS sim
                 FROM products
                 WHERE (similarity(name, $1) > 0.1
                        OR name ILIKE '%' || $1 || '%'
                        OR category ILIKE '%' || $1 || '%')
                 ${category ? `AND category ILIKE '%' || $3 || '%'` : ''}
                 ORDER BY sim DESC, popularity DESC
                 LIMIT $2`,
                ...queryParams
            );

            return NextResponse.json({ success: true, data: products });
        } catch {
            // Fallback: pg_trgm not available, use standard ILIKE search
            const where: any = {
                OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { category: { contains: query, mode: 'insensitive' as const } },
                ],
            };

            if (category) {
                where.AND = { category: { equals: category, mode: 'insensitive' } };
            }

            const products = await prisma.product.findMany({
                where,
                orderBy: { popularity: 'desc' },
                take: limit,
            });

            return NextResponse.json({ success: true, data: products });
        }
    } catch (error: any) {
        console.error('Product search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
