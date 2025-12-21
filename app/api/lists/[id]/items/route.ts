// List items API routes

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { createListItemSchema, updateListItemSchema } from '@/lib/validations';
import {
  getGuestList,
  getGuestLists,
  addGuestListItem,
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

// GET /api/lists/[id]/items - Get all items in a list
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';
    const isGuestEmail = session?.user?.email === 'guest@carto.local';

    // Handle ONLY truly unauthenticated guest users (no session, guest mode enabled)
    // Note: guest@carto.local users have sessions and use the database, not the guest store
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);
      const list = getGuestList(sessionId, params.id);

      if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }

      const response = NextResponse.json({ success: true, data: list.items || [] });

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

    // Check if user is logged in (includes guest@carto.local users)

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
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const items = await prisma.listItem.findMany({
      where: { listId: params.id },
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
    console.log('[DEBUG POST START] Request received for list:', params.id);

    const session = await getServerSession(authOptions);
    const guestMode = request.cookies.get('guest_mode')?.value === 'true';
    const isGuestEmail = session?.user?.email === 'guest@carto.local';

    console.log('[DEBUG POST] Session and mode info:', {
      hasSession: !!session,
      guestMode,
      isGuestEmail,
      sessionEmail: session?.user?.email,
    });

    const body = await request.json();
    const validatedData = createListItemSchema.parse(body);

    // Handle ONLY truly unauthenticated guest users (no session, guest mode enabled)
    // Note: guest@carto.local users have sessions and use the database, not the guest store
    if (guestMode && !session) {
      const { sessionId, needsCookie } = getGuestSessionId(request);

      console.log('[DEBUG GUEST] Guest session info:', {
        sessionId,
        needsCookie,
        requestedListId: params.id,
      });

      const list = getGuestList(sessionId, params.id);

      if (!list) {
        // Debug: check all lists for this session
        const allLists = getGuestLists(sessionId);
        console.log('[DEBUG GUEST] List not found. All lists for this session:', {
          sessionId,
          listCount: allLists.length,
          listIds: allLists.map(l => l.id),
        });

        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }

      const item = addGuestListItem(sessionId, params.id, {
        name: validatedData.name,
        quantity: validatedData.quantity || 1,
        category: validatedData.category || null,
        isCollected: false,
      });

      if (!item) {
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
      }

      const response = NextResponse.json({ success: true, data: item }, { status: 201 });

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

    // Check if user is logged in (includes guest@carto.local users)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Database operations for logged-in users
    console.log('[DEBUG POST] Attempting to find list with params:', {
      listId: params.id,
      userId: session.user.id,
      userEmail: session.user.email,
    });

    const list = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!list) {
      console.log('[DEBUG] List not found. Params ID:', params.id, 'Session User ID:', session.user.id);

      // Additional debugging: check if list exists at all
      const anyList = await prisma.shoppingList.findUnique({
        where: { id: params.id },
      });
      console.log('[DEBUG] List exists in DB (any user):', !!anyList, anyList ? `Owner: ${anyList.userId}` : 'N/A');

      return NextResponse.json({ error: 'List not found' }, { status: 404 });
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

