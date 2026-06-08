// Individual list API routes

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createListSchema, updateListSchema } from '@/lib/validations';
import { getPermanentDeleteAt, purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';
import { errorResponse, successResponse } from '@/lib/api-response';

// GET /api/lists/[id] - Get a specific list
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
        deletedAt: null,
      },
      include: {
        items: true,
      },
    });

    if (!list) {
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[lists GET]', {
        listId: params.id,
        ownerType: owner.type,
        itemCount: list.items.length,
      });
    }

    return successResponse(list);
  } catch (error) {
    console.error('Error fetching list:', error);
    return errorResponse('Failed to fetch list', 500, 'INTERNAL_SERVER_ERROR');
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
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
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
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    if (await isListActiveOnCart(params.id)) {
      return errorResponse(ACTIVE_LIST_LOCK_MESSAGE, 409, 'LIST_ACTIVE_ON_CART');
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

    return successResponse(updatedList);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    console.error('Error updating list:', error);
    return errorResponse('Failed to update list', 500, 'INTERNAL_SERVER_ERROR');
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
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
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
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    if (await isListActiveOnCart(params.id)) {
      return errorResponse(ACTIVE_LIST_LOCK_MESSAGE, 409, 'LIST_ACTIVE_ON_CART');
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

    return successResponse({ deletedAt, permanentDeleteAt });
  } catch (error) {
    console.error('Error deleting list:', error);
    return errorResponse('Failed to delete list', 500, 'INTERNAL_SERVER_ERROR');
  }
}
