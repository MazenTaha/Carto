// Individual list item API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateListItemSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';

// PUT /api/lists/[id]/items/[itemId] - Update an item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const owner = await requireUserOrGuest();
    
    const body = await request.json();
    const validatedData = updateListItemSchema.parse(body);

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

    const existingItem = await prisma.listItem.findFirst({
      where: { id: params.itemId, listId: params.id },
      select: { id: true },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = await prisma.listItem.update({
      where: { id: existingItem.id },
      data: {
        ...validatedData,
        collectedAt: validatedData.isCollected === true
          ? new Date()
          : validatedData.isCollected === false
            ? null
            : undefined,
      },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[id]/items/[itemId] - Delete an item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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

    if (await isListActiveOnCart(params.id)) {
      return NextResponse.json(
        { error: ACTIVE_LIST_LOCK_MESSAGE },
        { status: 409 }
      );
    }

    const item = await prisma.listItem.findFirst({
      where: { id: params.itemId, listId: params.id },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.listItem.delete({
      where: { id: item.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}
