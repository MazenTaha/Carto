import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LOCAL_PRODUCTS } from '@/lib/product-dataset';
import { ProductCategorySummary } from '@/types';
import { PRODUCT_CATEGORY_FALLBACKS, sortProductCategoryNames } from '@/lib/product-finder';

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
      return NextResponse.json({ success: true, data: buildLocalCategorySummaries() });
    }

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

    const data: ProductCategorySummary[] = sortedCategories.map((name) => ({
      name,
      count: countByCategory.get(name) ?? 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Product categories error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product categories' },
      { status: 500 }
    );
  }
}
