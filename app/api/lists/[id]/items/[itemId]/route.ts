// Individual list item API routes

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateListItemSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';
import { errorResponse, successResponse } from '@/lib/api-response';
import { normalizeBasePriceEGP } from '@/lib/pricing';

export const runtime = "nodejs";

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
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
      },
      select: { id: true },
    });

    if (!list) {
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    if (await isListActiveOnCart(params.id)) {
      return errorResponse(ACTIVE_LIST_LOCK_MESSAGE, 409, 'LIST_ACTIVE_ON_CART');
    }

    const existingItem = await prisma.listItem.findFirst({
      where: { id: params.itemId, listId: params.id },
      select: { id: true },
    });

    if (!existingItem) {
      return errorResponse('Item not found', 404, 'NOT_FOUND');
    }

    const item = await prisma.listItem.update({
      where: { id: existingItem.id },
      data: {
        ...validatedData,
        price: validatedData.price === undefined ? undefined : normalizeBasePriceEGP(validatedData.price),
        collectedAt: validatedData.isCollected === true
          ? new Date()
          : validatedData.isCollected === false
            ? null
            : undefined,
      },
    });

    return successResponse(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.code === 'P2025') {
      return errorResponse('Item not found', 404, 'NOT_FOUND');
    }

    console.error('Error updating item:', error);
    return errorResponse('Failed to update item', 500, 'INTERNAL_SERVER_ERROR');
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
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
      },
      select: { id: true },
    });

    if (!list) {
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    if (await isListActiveOnCart(params.id)) {
      return errorResponse(ACTIVE_LIST_LOCK_MESSAGE, 409, 'LIST_ACTIVE_ON_CART');
    }

    const item = await prisma.listItem.findFirst({
      where: { id: params.itemId, listId: params.id },
      select: { id: true },
    });

    if (!item) {
      return errorResponse('Item not found', 404, 'NOT_FOUND');
    }

    await prisma.listItem.delete({
      where: { id: item.id },
    });

    return successResponse({ deleted: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return errorResponse('Item not found', 404, 'NOT_FOUND');
    }

    console.error('Error deleting item:', error);
    return errorResponse('Failed to delete item', 500, 'INTERNAL_SERVER_ERROR');
  }
}
