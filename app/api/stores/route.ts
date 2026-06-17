// Stores API route

import { NextResponse } from 'next/server';
import { getCachedStores } from '@/lib/cache/catalog-cache';
import { withNoStoreHeaders, withPublicCacheHeaders } from '@/lib/http-cache';

export const runtime = "nodejs";
export const revalidate = 3600;

// GET /api/stores - List all stores
export async function GET() {
    try {
        const stores = await getCachedStores();

        return withPublicCacheHeaders(
            NextResponse.json({ success: true, data: stores }),
            { sMaxAge: 3600, staleWhileRevalidate: 86400 }
        );
    } catch (error) {
        console.error('Error fetching stores:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to fetch stores' },
                { status: 500 }
            )
        );
    }
}
