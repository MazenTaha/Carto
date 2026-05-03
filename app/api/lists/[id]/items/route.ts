// List items API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createListItemSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';

// GET /api/lists/[id]/items - Get all items in a list
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
      },
      select: { id: true },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const items = await prisma.listItem.findMany({
      where: { listId: params.id },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST /api/lists/[id]/items - Add an item to a list
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    const body = await request.json();
    const validatedData = createListItemSchema.parse(body);

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
      },
      select: { id: true },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    if (await isListActiveOnCart(params.id)) {
      return NextResponse.json(
        { error: ACTIVE_LIST_LOCK_MESSAGE },
        { status: 409 }
      );
    }

    // Check for duplicates in database
    const existingItem = await prisma.listItem.findFirst({
      where: {
        listId: params.id,
        name: {
          equals: validatedData.name,
          mode: 'insensitive', // Case insensitive check
        },
      },
      select: { id: true },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: 'Item already exists in the list' },
        { status: 400 }
      );
    }

    const item = await prisma.listItem.create({
      data: {
        ...validatedData,
        listId: params.id,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}
