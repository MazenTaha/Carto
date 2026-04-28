// Individual list API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { createListSchema, updateListSchema } from '@/lib/validations';
import {
  getGuestList,
  getGuestLists,
  updateGuestList,
  deleteGuestList,
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

// GET /api/lists/[id] - Get a specific list
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

      const response = NextResponse.json({ success: true, data: list });

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

    // Database query for logged-in users
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
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
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';

    const body = await request.json();
    const validatedData = updateListSchema.parse(body);

    // Handle guest users
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);

      const updatedList = updateGuestList(sessionId, params.id, validatedData);

      if (!updatedList) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }

      const response = NextResponse.json({ success: true, data: updatedList });

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

    // Database operations for logged-in users
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const updatedList = await prisma.shoppingList.update({
      where: { id: params.id },
      data: validatedData,
      include: { items: true },
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

// DELETE /api/lists/[id] - Delete a list
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';

    // Handle guest users
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const deleted = deleteGuestList(sessionId, params.id);

      if (!deleted) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
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

    // Database operations for logged-in users
    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    await prisma.shoppingList.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting list:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}

