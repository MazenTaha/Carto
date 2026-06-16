import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
import { guardAdminApi } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { normalizeBasePriceEGP } from '@/lib/pricing';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  emoji: z.string().max(10).optional(),
  price: z.number().min(0),
  popularity: z.number().int().min(0).optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

// GET /api/admin/products
export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'));
  const skip = (page - 1) * pageSize;

  try {
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { popularity: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          category: true,
          emoji: true,
          price: true,
          popularity: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: data.map((product) => ({
        ...product,
        price: normalizeBasePriceEGP(product.price),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('[admin/products GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/admin/products
export async function POST(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        price: normalizeBasePriceEGP(parsed.data.price),
      },
    });
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A product with that name already exists' },
        { status: 409 }
      );
    }
    console.error('[admin/products POST]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/products
export async function PATCH(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { id, ...data } = parsed.data;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        price: data.price === undefined ? undefined : normalizeBasePriceEGP(data.price),
      },
    });
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error('[admin/products PATCH]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products?id=xxx
export async function DELETE(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Product ID required' },
      { status: 400 }
    );
  }

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/products DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
