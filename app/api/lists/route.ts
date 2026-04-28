// Shopping lists API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { createListSchema } from '@/lib/validations';
import {
  getGuestLists,
  createGuestList,
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

// GET /api/lists - Get all lists for the user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';

    // Check if user is a guest
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const lists = getGuestLists(sessionId);

      // Format lists to match database structure
      const formattedLists = lists.map(list => ({
        ...list,
        _count: { items: list.items?.length || 0 },
      }));

      const response = NextResponse.json({ success: true, data: formattedLists });

      // Set cookie if needed
      if (needsCookie) {
        response.cookies.set('guest_session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
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
    const lists = await prisma.shoppingList.findMany({
      where: { userId: session.user.id },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
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
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';

    const body = await request.json();
    const validatedData = createListSchema.parse(body);

    // Handle guest users
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const list = createGuestList(sessionId, validatedData.name);

      const response = NextResponse.json(
        { success: true, data: list },
        { status: 201 }
      );

      // Set cookie if needed
      if (needsCookie) {
        response.cookies.set('guest_session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
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
    const list = await prisma.shoppingList.create({
      data: {
        name: validatedData.name,
        userId: session.user.id,
      },
      include: {
        items: true,
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

