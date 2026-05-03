// Individual list API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createListSchema, updateListSchema } from '@/lib/validations';
import { getPermanentDeleteAt, purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';

// GET /api/lists/[id] - Get a specific list
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
        deletedAt: null,
      },
      include: {
        items: true,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    );
  }
}

// PUT /api/lists/[id] - Update a list
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    const body = await request.json();
    const validatedData = updateListSchema.parse(body);

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
        deletedAt: null,
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

    const updatedList = await prisma.shoppingList.update({
      where: { id: params.id },
      data: validatedData,
      select: {
        id: true,
        name: true,
        userId: true,
        guestSessionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updatedList });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating list:', error);
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[id] - Move a list to recently deleted for 30 days
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerFilter = ownerWhere(owner);
    await purgeExpiredShoppingLists(prisma, ownerFilter);
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerFilter,
        deletedAt: null,
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

    const deletedAt = new Date();
    const permanentDeleteAt = getPermanentDeleteAt(deletedAt);

    await prisma.shoppingList.update({
      where: { id: params.id },
      data: {
        deletedAt,
        permanentDeleteAt,
      },
    });

    return NextResponse.json({ success: true, data: { deletedAt, permanentDeleteAt } });
  } catch (error) {
    console.error('Error deleting list:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}
