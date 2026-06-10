// List items API routes

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createListItemSchema } from '@/lib/validations';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_LIST_LOCK_MESSAGE, isListActiveOnCart } from '@/lib/list-session-lock';
import { errorResponse, successResponse } from '@/lib/api-response';
import { formatListItemName, normalizeListItemName } from '@/lib/list-items';

export const runtime = "nodejs";

// GET /api/lists/[id]/items - Get all items in a list
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
      },
      select: { id: true },
    });

    if (!list) {
      return errorResponse('List not found', 404, 'NOT_FOUND');
    }

    const items = await prisma.listItem.findMany({
      where: { listId: params.id },
      orderBy: { id: 'asc' },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[lists/items GET]', {
        listId: params.id,
        ownerType: owner.type,
        itemCount: items.length,
      });
    }

    return successResponse(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return errorResponse('Failed to fetch items', 500, 'INTERNAL_SERVER_ERROR');
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
    const formattedName = formatListItemName(validatedData.name);
    const normalizedName = normalizeListItemName(validatedData.name);

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

    const existingItems = await prisma.listItem.findMany({
      where: { listId: params.id },
      select: {
        id: true,
        name: true,
        quantity: true,
        price: true,
        category: true,
        isCollected: true,
        collectedAt: true,
        listId: true,
      },
    });

    const existingItem = existingItems.find((item) => normalizeListItemName(item.name) === normalizedName);

    if (existingItem) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[lists/items POST] duplicate', {
          listId: params.id,
          ownerType: owner.type,
          normalizedName,
          existingItemId: existingItem.id,
        });
      }

      return Response.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_LIST_ITEM',
            message: 'Item already exists in the list',
          },
          data: {
            existingItem,
          },
        },
        { status: 409 }
      );
    }

    const item = await prisma.listItem.create({
      data: {
        ...validatedData,
        name: formattedName,
        listId: params.id,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[lists/items POST] created', {
        listId: params.id,
        ownerType: owner.type,
        itemId: item.id,
      });
    }

    return successResponse(item, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    console.error('Error creating item:', error);
    return errorResponse('Failed to create item', 500, 'INTERNAL_SERVER_ERROR');
  }
}
