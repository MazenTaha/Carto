import { NextResponse } from 'next/server';

export const runtime = "nodejs";
export const revalidate = 3600;
import { LOCAL_PRODUCTS } from '@/lib/product-dataset';
import { ProductCategorySummary } from '@/types';
import { PRODUCT_CATEGORY_FALLBACKS } from '@/lib/product-finder';
import { getCachedProductCategories } from '@/lib/cache/catalog-cache';
import { withPublicCacheHeaders, withNoStoreHeaders } from '@/lib/http-cache';

function buildLocalCategorySummaries() {
  const counts = new Map<string, number>();

  for (const category of PRODUCT_CATEGORY_FALLBACKS) {
    counts.set(category, 0);
  }

  for (const product of LOCAL_PRODUCTS) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }

  const summaries: ProductCategorySummary[] = [...counts.entries()].map(([name, count]) => ({
    name,
    count,
  }));

  return summaries;
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return withPublicCacheHeaders(
        NextResponse.json({ success: true, data: buildLocalCategorySummaries() }),
        { sMaxAge: 3600, staleWhileRevalidate: 86400 }
      );
    }

    const data = await getCachedProductCategories();

    return withPublicCacheHeaders(
      NextResponse.json({ success: true, data }),
      { sMaxAge: 3600, staleWhileRevalidate: 86400 }
    );
  } catch (error) {
    console.error('Product categories error:', error);
    return withNoStoreHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch product categories' },
        { status: 500 }
      )
    );
  }
}
