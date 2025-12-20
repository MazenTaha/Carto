// Individual list item API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { updateListItemSchema } from '@/lib/validations';
import {
  getGuestList,
  updateGuestListItem,
  deleteGuestListItem,
  generateGuestSessionId,
} from '@/store/guest-store';

// Helper function to get or create guest session ID
function getGuestSessionId(request: NextRequest): { sessionId: string; needsCookie: boolean } {
  let guestSessionId = request.cookies.get('guest_session_id')?.value;
  
  if (!guestSessionId) {
    guestSessionId = generateGuestSessionId();
    return { sessionId: guestSessionId, needsCookie: true };
  }
  
  return { sessionId: guestSessionId, needsCookie: false };
}

// PUT /api/lists/[id]/items/[itemId] - Update an item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';
    
    const body = await request.json();
    const validatedData = updateListItemSchema.parse(body);

    // Handle guest users
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const list = getGuestList(sessionId, params.id);
      
      if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }
      
      const item = updateGuestListItem(sessionId, params.id, params.itemId, validatedData);
      
      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      
      const response = NextResponse.json({ success: true, data: item });
      
      // Set cookie if needed
      if (needsCookie) {
        response.cookies.set('guest_session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
      
      return response;
    }

    // Check if user is logged in
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify list ownership for logged-in users
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const item = await prisma.listItem.update({
      where: { id: params.itemId },
      data: {
        ...validatedData,
        collectedAt: validatedData.isCollected
          ? new Date()
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
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';
    
    // Handle guest users
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const list = getGuestList(sessionId, params.id);
      
      if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }
      
      const deleted = deleteGuestListItem(sessionId, params.id, params.itemId);
      
      if (!deleted) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      
      const response = NextResponse.json({ success: true });
      
      // Set cookie if needed
      if (needsCookie) {
        response.cookies.set('guest_session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
      
      return response;
    }

    // Check if user is logged in
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify list ownership for logged-in users
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    await prisma.listItem.delete({
      where: { id: params.itemId },
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

