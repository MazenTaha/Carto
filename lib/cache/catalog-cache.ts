import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { sortProductCategoryNames } from '@/lib/product-finder';
import { normalizeBasePriceEGP } from '@/lib/pricing';
import type { ProductCategorySummary, ProductSearchResult } from '@/types';

const productSearchSelect = {
  id: true,
  name: true,
  category: true,
  emoji: true,
  price: true,
  popularity: true,
} as const;

function buildDbWhere(query: string, category: string) {
  return {
    ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { category: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export async function getCachedPublicProducts(input: {
  query: string;
  category: string;
  limit: number;
  tab: 'popular' | 'recent';
}) {
  const cacheKey = [
    'catalog-products',
    input.tab,
    input.category.trim().toLowerCase() || 'all',
    input.query.trim().toLowerCase() || 'all',
    String(input.limit),
  ];
  const revalidate = input.query ? 120 : 300;

  return unstable_cache(
    async () => {
      const orderBy =
        input.tab === 'recent'
          ? [{ createdAt: 'desc' as const }, { popularity: 'desc' as const }]
          : [{ popularity: 'desc' as const }, { createdAt: 'desc' as const }];

      const products = await prisma.product.findMany({
        where: buildDbWhere(input.query, input.category),
        orderBy,
        take: input.limit,
        select: productSearchSelect,
      });

      return products.map((product): ProductSearchResult => ({
        ...product,
        price: normalizeBasePriceEGP(product.price),
      }));
    },
    cacheKey,
    {
      revalidate,
      tags: ['products'],
    }
  )();
}

export const getCachedProductCategories = unstable_cache(
  async () => {
    const groupedCategories = await prisma.product.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
    });

    const sortedCategories = sortProductCategoryNames(
      groupedCategories
        .map((entry) => entry.category?.trim())
        .filter((category): category is string => Boolean(category))
    );

    const countByCategory = new Map(
      groupedCategories.map((entry) => [entry.category, entry._count.category])
    );

    return sortedCategories.map((name): ProductCategorySummary => ({
      name,
      count: countByCategory.get(name) ?? 0,
    }));
  },
  ['catalog-product-categories'],
  {
    revalidate: 3600,
    tags: ['products', 'categories'],
  }
);

export const getCachedStores = unstable_cache(
  async () =>
    prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { carts: true } },
      },
    }),
  ['public-stores'],
  {
    revalidate: 3600,
    tags: ['stores'],
  }
);
