// Shopping lists API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createListRequestSchema } from '@/lib/validations';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerCreateData, ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { buildCurrentCustomerCartSessionWhere } from '@/lib/current-cart-session';
import { ACTIVE_SESSION_CREATE_LIST_MESSAGE } from '@/lib/list-constants';
import { formatListItemName, normalizeListItemName } from '@/lib/list-items';

export const runtime = "nodejs";

// GET /api/lists - Get all lists for the user
export async function GET(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerFilter = ownerWhere(owner);
    await purgeExpiredShoppingLists(prisma, ownerFilter);
    const showDeleted = request.nextUrl.searchParams.get('deleted') === '1';
    const lists = await prisma.shoppingList.findMany({
      where: {
        ...ownerFilter,
        deletedAt: showDeleted ? { not: null } : null,
        ...(showDeleted ? {} : { items: { some: {} } }),
      },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
      orderBy: showDeleted ? { deletedAt: 'desc' } : { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: lists });
  } catch (error) {
    console.error('Error fetching lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  }
}

// POST /api/lists - Create a new list
export async function POST(request: NextRequest) {
  try {
    const owner = await requireUserOrGuest();

    const body = await request.json();
    const validatedData = createListRequestSchema.parse(body);

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerFilter = ownerWhere(owner);
    const existingSession = await prisma.cartSession.findFirst({
      where: buildCurrentCustomerCartSessionWhere(ownerFilter),
      select: { id: true },
    });

    if (existingSession) {
      return NextResponse.json(
        { error: ACTIVE_SESSION_CREATE_LIST_MESSAGE },
        { status: 409 }
      );
    }

    const deduplicatedItems = new Map<string, {
      name: string;
      quantity: number;
      price: number;
      category: string | undefined;
    }>();

    for (const item of validatedData.items) {
      const normalizedName = normalizeListItemName(item.name);
      const existingItem = deduplicatedItems.get(normalizedName);

      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.price = item.price ?? existingItem.price;
        existingItem.category = item.category ?? existingItem.category;
        continue;
      }

      deduplicatedItems.set(normalizedName, {
        name: formatListItemName(item.name),
        quantity: item.quantity,
        price: item.price ?? 0,
        category: item.category,
      });
    }

    const list = await prisma.shoppingList.create({
      data: {
        name: validatedData.name,
        ...ownerCreateData(owner),
        items: {
          create: Array.from(deduplicatedItems.values()),
        },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        guestSessionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: list }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating list:', error);
    return NextResponse.json(
      { error: 'Failed to create list' },
      { status: 500 }
    );
  }
}
