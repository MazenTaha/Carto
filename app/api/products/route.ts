import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-config';
import { getCachedPublicProducts } from '@/lib/cache/catalog-cache';
import { withNoStoreHeaders, withPublicCacheHeaders } from '@/lib/http-cache';
import { LOCAL_PRODUCTS } from '@/lib/product-dataset';
import { ProductFinderTab, ProductSearchResult } from '@/types';
import { isProductFinderTab } from '@/lib/product-finder';
import { normalizeBasePriceEGP } from '@/lib/pricing';

const productSearchSelect = {
  id: true,
  name: true,
  category: true,
  emoji: true,
  price: true,
  popularity: true,
} as const;

function normalizeQuery(searchParams: URLSearchParams) {
  return (searchParams.get('query') ?? searchParams.get('q') ?? '').trim();
}

function normalizeCategory(searchParams: URLSearchParams) {
  return searchParams.get('category')?.trim() ?? '';
}

function normalizeLimit(searchParams: URLSearchParams) {
  return Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
}

function normalizeTab(searchParams: URLSearchParams): ProductFinderTab {
  const tab = searchParams.get('tab');
  return isProductFinderTab(tab) ? tab : 'popular';
}

function matchesQuery(product: { name: string; category: string }, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(normalizedQuery) ||
    product.category.toLowerCase().includes(normalizedQuery)
  );
}

function matchesCategory(product: { category: string }, category: string) {
  if (!category) {
    return true;
  }

  return product.category.toLowerCase() === category.toLowerCase();
}

function mapLocalProduct(product: (typeof LOCAL_PRODUCTS)[number], index: number): ProductSearchResult {
  return {
    id: `local_${index}_${product.name.replace(/\s+/g, '_')}`,
    name: product.name,
    category: product.category,
    emoji: product.emoji ?? null,
    price: normalizeBasePriceEGP(product.price),
    popularity: product.popularity ?? 0,
  };
}

function filterLocalProducts({
  category,
  limit,
  query,
  tab,
}: {
  category: string;
  limit: number;
  query: string;
  tab: ProductFinderTab;
}) {
  const localProducts = LOCAL_PRODUCTS
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => matchesCategory(product, category))
    .filter(({ product }) => matchesQuery(product, query));

  const sorted = [...localProducts].sort((left, right) => {
    if (tab === 'recent') {
      return right.index - left.index;
    }

    return (right.product.popularity ?? 0) - (left.product.popularity ?? 0);
  });

  return sorted
    .slice(0, limit)
    .map(({ product }, index) => mapLocalProduct(product, index));
}

async function getFavoriteProducts({
  category,
  limit,
  query,
}: {
  category: string;
  limit: number;
  query: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  const favorites = await prisma.userFavoriteProduct.findMany({
    where: {
      userId: session.user.id,
      product: {
        ...(category
          ? { category: { equals: category, mode: 'insensitive' as const } }
          : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { category: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    },
    orderBy: [
      { purchaseCount: 'desc' },
      { lastPurchased: 'desc' },
    ],
    take: limit,
    select: {
      product: {
        select: productSearchSelect,
      },
    },
  });

  return favorites
    .map((favorite) => favorite.product ? ({
      ...favorite.product,
      price: normalizeBasePriceEGP(favorite.product.price),
    }) : null)
    .filter((product): product is ProductSearchResult => Boolean(product));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = normalizeQuery(searchParams);
  const limit = normalizeLimit(searchParams);
  const category = normalizeCategory(searchParams);
  const tab = normalizeTab(searchParams);
  const publicCacheProfile = query
    ? { sMaxAge: 120, staleWhileRevalidate: 600 }
    : { sMaxAge: 300, staleWhileRevalidate: 3600 };

  try {
    if (!process.env.DATABASE_URL) {
      const localResults = filterLocalProducts({ query, limit, category, tab });
      return withPublicCacheHeaders(
        NextResponse.json({ success: true, data: localResults }),
        publicCacheProfile
      );
    }

    if (tab === 'favorites') {
      const favoriteProducts = await getFavoriteProducts({ query, limit, category });
      return withNoStoreHeaders(NextResponse.json({ success: true, data: favoriteProducts }));
    }

    const products = await getCachedPublicProducts({
      query,
      category,
      limit,
      tab: tab === 'recent' ? 'recent' : 'popular',
    });

    return withPublicCacheHeaders(
      NextResponse.json({
        success: true,
        data: products,
      }),
      publicCacheProfile
    );
  } catch (error: any) {
    console.error('Product search error:', error);
    return withNoStoreHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      )
    );
  }
}
