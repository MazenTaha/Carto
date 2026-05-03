
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LOCAL_PRODUCTS } from '@/lib/product-dataset';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const category = searchParams.get('category');

    try {
        // Local fallback when the product database is not configured.
        if (!process.env.DATABASE_URL) {
            const q = query.trim().toLowerCase();
            const filtered = LOCAL_PRODUCTS
                .filter((p) => {
                    if (category && p.category.toLowerCase() !== category.toLowerCase()) return false;
                    if (!q) return true;
                    return (
                        p.name.toLowerCase().includes(q) ||
                        p.category.toLowerCase().includes(q)
                    );
                })
                .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
                .slice(0, limit)
                .map((p, idx) => ({
                    id: `local_${idx}_${p.name.replace(/\s+/g, '_')}`,
                    name: p.name,
                    category: p.category,
                    emoji: p.emoji ?? null,
                    price: p.price ?? 0,
                    popularity: p.popularity ?? 0,
                }));

            return NextResponse.json({ success: true, data: filtered });
        }

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
                select: {
                    id: true,
                    name: true,
                    category: true,
                    emoji: true,
                    price: true,
                    popularity: true,
                },
            });

            return NextResponse.json({ success: true, data: products });
        }

        // Standard search (safe + fast). If you want trigram similarity, enable it via migrations.
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
            select: {
                id: true,
                name: true,
                category: true,
                emoji: true,
                price: true,
                popularity: true,
            },
        });

        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        console.error('Product search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
